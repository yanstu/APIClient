#!/usr/bin/env bash
#
# cursor-mac-worker.sh
#
# 在本地 Mac 上启动 Cursor "My Machines" worker，
# 让 Cloud Agents 的工具调用在你自己的机器上执行。
#
# 用法:
#   ./scripts/cursor-mac-worker.sh            # 启动 worker
#   ./scripts/cursor-mac-worker.sh --debug    # 仅运行 worker 预检（agent worker debug）
#
# 可选环境变量:
#   CURSOR_WORKER_NAME   worker 名称（默认取主机名，取不到时用 "my-mac"）
#   CURSOR_API_KEY       API Key，设置后跳过交互式登录检查
#   CURSOR_AGENT_BIN     显式指定 Cursor CLI 路径（跳过自动探测）
#
set -euo pipefail

# ---------------------------------------------------------------------------
# 脚本启动即确保 PATH 包含安装器默认落盘目录 ~/.local/bin
# ---------------------------------------------------------------------------
export PATH="${HOME}/.local/bin:${PATH}"

# ---------------------------------------------------------------------------
# 路径定位：脚本位于 <repo>/scripts/，仓库根目录即其上一级
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 若在 git 仓库内，以 git 顶层目录为准（更稳妥）
if command -v git >/dev/null 2>&1; then
  GIT_TOP="$(git -C "${SCRIPT_DIR}" rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "${GIT_TOP}" ]]; then
    REPO_ROOT="${GIT_TOP}"
  fi
fi

# ---------------------------------------------------------------------------
# 参数解析
# ---------------------------------------------------------------------------
DEBUG_MODE=0
for arg in "$@"; do
  case "${arg}" in
    --debug)
      DEBUG_MODE=1
      ;;
    -h|--help)
      sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "未知参数: ${arg}（支持 --debug / --help）" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# 平台检查
# ---------------------------------------------------------------------------
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "警告: 此脚本面向 macOS 设计，当前系统为 $(uname -s)，继续执行但不保证行为一致。" >&2
fi

# ---------------------------------------------------------------------------
# 安装 / 定位 cursor CLI（幂等：已安装则跳过）
# ---------------------------------------------------------------------------
# 安静检查：判断某个二进制是否为 Grok CLI 等冒名顶替者。
# 返回 0 表示是冒名者（不可用），返回 1 表示不是冒名者。
is_grok_impostor() {
  local bin="$1"
  local version_output
  version_output="$("${bin}" --version </dev/null 2>/dev/null || true)"
  # Grok CLI 版本输出形如 "grok ..." 或 "0.x.y"；
  # Cursor CLI 版本是日期格式（如 2025.01.17-xxxx）
  if [[ "${version_output}" =~ ^[Gg]rok ]] || [[ "${version_output}" =~ ^0\.[0-9] ]]; then
    return 0
  fi
  return 1
}

find_agent_bin() {
  # 0. 显式覆盖：CURSOR_AGENT_BIN 优先级最高
  if [[ -n "${CURSOR_AGENT_BIN:-}" ]]; then
    echo "${CURSOR_AGENT_BIN}"
    return
  fi
  # 1. 绝对路径优先：安装器的默认落盘路径（最可靠，不受 PATH 中同名命令干扰）
  if [[ -x "${HOME}/.local/bin/cursor-agent" ]]; then
    # 若 cursor-agent 不在 PATH 中，但绝对路径下存在该文件，直接使用它并提示
    if ! command -v cursor-agent >/dev/null 2>&1; then
      echo "==> 注意: cursor-agent 不在 PATH 中，但已在 ${HOME}/.local/bin/cursor-agent 找到，直接使用绝对路径。" >&2
    fi
    echo "${HOME}/.local/bin/cursor-agent"
    return
  fi
  # 2. 绝对路径回退：仅当 ~/.local/bin/agent 不是 Grok 等冒名者时才使用
  if [[ -x "${HOME}/.local/bin/agent" ]] && ! is_grok_impostor "${HOME}/.local/bin/agent"; then
    echo "${HOME}/.local/bin/agent"
    return
  fi
  # 3. 优先 cursor-agent：`agent` 这个名字可能被其它 CLI（如 Grok CLI）占用
  if command -v cursor-agent >/dev/null 2>&1; then
    echo "cursor-agent"
    return
  fi
  # 4. 仅当 `agent` 不是 Grok 等冒名者时才回退使用它；
  #    绝不把 Grok 的 `agent` 当作 Cursor CLI 交给 worker 命令使用
  if command -v agent >/dev/null 2>&1 && ! is_grok_impostor "agent"; then
    echo "agent"
    return
  fi
  echo ""
}

# 触发官方安装脚本重新安装 Cursor CLI，并刷新 PATH / 命令缓存
reinstall_cursor_cli() {
  echo "==> 尝试重新安装 Cursor CLI ..." >&2
  curl https://cursor.com/install -fsS | bash || true
  export PATH="${HOME}/.local/bin:${PATH}"
  hash -r
}

# 校验候选 CLI 路径确实指向一个真实存在、可用的文件。
# 处理三种情况:
#   1. 普通命令名（在 PATH 中可解析）：直接放行，交由后续版本校验判断。
#   2. 显式文件路径：必须存在（-f/-x）；
#   3. 符号链接：必须能解析到真实存在的目标（readlink -f + test -e）；
#      若为断链（broken symlink），打印中文错误并触发重装。
# 返回 0 表示可用；返回 1 表示不可用（并已在必要时触发重装）。
verify_binary_exists() {
  local bin="$1"

  # 情况 1: 传入的是纯命令名（不含路径分隔符），交给 PATH 解析
  if [[ "${bin}" != */* ]]; then
    if command -v "${bin}" >/dev/null 2>&1; then
      return 0
    fi
    echo "错误: 命令 '${bin}' 不在 PATH 中，无法定位到可执行文件。" >&2
    reinstall_cursor_cli
    return 1
  fi

  # 情况 2/3: 传入的是文件路径

  # 断链检测：路径本身是符号链接，但解析后的目标不存在
  if [[ -L "${bin}" ]]; then
    local resolved
    resolved="$(readlink -f "${bin}" 2>/dev/null || true)"
    if [[ -z "${resolved}" || ! -e "${resolved}" ]]; then
      echo "错误: '${bin}' 是一个断开的符号链接（broken symlink），指向的目标不存在。" >&2
      echo "      解析结果: ${resolved:-无法解析}" >&2
      echo "      这通常意味着 Cursor CLI 曾被安装后又被删除或移动。" >&2
      reinstall_cursor_cli
      return 1
    fi
  fi

  # 常规文件存在性检查：既不是普通文件也不是可执行文件即视为不存在
  if [[ ! -e "${bin}" ]]; then
    echo "错误: 未找到 CLI 文件 '${bin}'（路径不存在）。" >&2
    reinstall_cursor_cli
    return 1
  fi
  if [[ ! -f "${bin}" && ! -x "${bin}" ]]; then
    echo "错误: '${bin}' 存在但既不是普通文件也不是可执行文件，无法作为 Cursor CLI 使用。" >&2
    reinstall_cursor_cli
    return 1
  fi

  return 0
}

# 校验解析出的二进制确实是 Cursor CLI，而不是同名的冒名顶替者（如 Grok CLI）
verify_agent_bin() {
  local bin="$1"
  local version_output help_output
  version_output="$("${bin}" --version </dev/null 2>/dev/null || true)"

  # 负向检查：Grok CLI 也会把自己安装为 `agent`。
  # 其版本输出形如 "grok ..." 或 "0.x.y"（Cursor CLI 版本是日期格式，如 2025.01.17-xxxx）
  if [[ "${version_output}" =~ ^[Gg]rok ]] || [[ "${version_output}" =~ ^0\.[0-9] ]]; then
    echo "错误: 检测到 '${bin}' 实际上不是 Cursor CLI（版本输出: ${version_output:-空}）。" >&2
    echo "很可能是 Grok CLI 等其它工具占用了 'agent' 命令名，与 Cursor CLI 冲突。" >&2
    echo "" >&2
    echo "解决方法（任选其一）:" >&2
    echo "  1. 直接使用 'cursor-agent' 命令（Cursor CLI 的完整命令名）" >&2
    echo "  2. 重新安装 Cursor CLI:  curl https://cursor.com/install -fsS | bash" >&2
    echo "  3. 设置 CURSOR_AGENT_BIN 指向正确的 Cursor CLI 路径后重试" >&2
    return 1
  fi

  # 正向检查（宽松）：版本为日期格式，或 --help 提及 cursor 即认为可信；
  # 无法确认时仅提示警告，不中断执行
  if [[ ! "${version_output}" =~ ^20[0-9][0-9]\. ]]; then
    help_output="$("${bin}" --help </dev/null 2>/dev/null || true)"
    if [[ "${help_output}" != *[Cc]ursor* ]]; then
      echo "警告: 无法确认 '${bin}' 是 Cursor CLI（版本输出: ${version_output:-空}），继续执行但可能出错。" >&2
    fi
  fi
  return 0
}

# 打印手动安装 Cursor CLI 的中文说明后退出
print_manual_install_help() {
  echo "" >&2
  echo "错误: 未能自动安装或定位到有效的 Cursor CLI (cursor-agent)。" >&2
  echo "" >&2
  echo "请按以下任一方式手动安装 Cursor CLI，然后重新运行本脚本:" >&2
  echo "" >&2
  echo "  方式一（推荐）: 打开 Cursor 应用，按下命令面板快捷键" >&2
  echo "     (macOS: Cmd+Shift+P)，输入并执行 \"Install 'cursor' command\"" >&2
  echo "     （或 \"Shell Command: Install cursor-agent CLI\"）以安装 CLI。" >&2
  echo "" >&2
  echo "  方式二: 在终端运行官方安装脚本:" >&2
  echo "     curl https://cursor.com/install -fsS | bash" >&2
  echo "" >&2
  echo "  安装完成后，确保 ~/.local/bin 在 PATH 中。可将下面这行加入 ~/.zshrc:" >&2
  echo "     export PATH=\"\$HOME/.local/bin:\$PATH\"" >&2
  echo "" >&2
  echo "  然后执行 'source ~/.zshrc'（或重新打开终端）后再次运行本脚本。" >&2
  echo "" >&2
  echo "  诊断提示: 若仍提示 command not found，请运行以下命令排查:" >&2
  echo "     echo \$PATH" >&2
  echo "     ~/.local/bin/cursor-agent --version" >&2
  echo "  确认 ~/.local/bin 是否在 PATH 中，以及 cursor-agent 是否已正确安装。" >&2
  echo "" >&2
}

AGENT_BIN="$(find_agent_bin)"

if [[ -z "${AGENT_BIN}" ]]; then
  # 走到这里说明：既没有 cursor-agent，也没有有效的 Cursor `agent`
  # （可能是未安装，或仅存在 Grok 等冒名顶替的 `agent`）。自动安装。
  echo "==> 未检测到有效的 Cursor CLI，开始自动安装 ..."
  curl https://cursor.com/install -fsS | bash || true
  export PATH="${HOME}/.local/bin:${PATH}"
  hash -r

  # 安装后显式复查安装器的默认落盘路径，避免受 PATH 中冒名者干扰
  if [[ -x "${HOME}/.local/bin/cursor-agent" ]]; then
    AGENT_BIN="${HOME}/.local/bin/cursor-agent"
    echo "==> cursor CLI 安装完成 (${AGENT_BIN})。"
  else
    # 再尝试常规探测（不会回退到 Grok 的 agent）
    AGENT_BIN="$(find_agent_bin)"
    if [[ -z "${AGENT_BIN}" ]]; then
      print_manual_install_help
      exit 1
    fi
    echo "==> cursor CLI 安装完成 (${AGENT_BIN})。"
  fi
else
  echo "==> 已检测到 cursor CLI (${AGENT_BIN})，跳过安装。"
fi

# 先确认候选 CLI 路径真实可用（存在 / 非断链），再做冒名者校验。
# 若首次校验失败，verify_binary_exists 会尝试重装，随后重新探测一次。
if ! verify_binary_exists "${AGENT_BIN}"; then
  AGENT_BIN="$(find_agent_bin)"
  if [[ -z "${AGENT_BIN}" ]] || ! verify_binary_exists "${AGENT_BIN}"; then
    print_manual_install_help
    exit 1
  fi
fi

verify_agent_bin "${AGENT_BIN}" || exit 1

echo "==> 使用 CLI: $(command -v "${AGENT_BIN}" || echo "${AGENT_BIN}")"
echo "==> CLI 版本: $("${AGENT_BIN}" --version </dev/null 2>/dev/null || echo '未知')"

# ---------------------------------------------------------------------------
# 登录状态检查
# ---------------------------------------------------------------------------
if [[ -n "${CURSOR_API_KEY:-}" ]]; then
  echo "==> 检测到 CURSOR_API_KEY，将使用 API Key 认证。"
else
  if "${AGENT_BIN}" status </dev/null >/dev/null 2>&1; then
    echo "==> 已登录 Cursor 账号。"
  else
    echo "尚未登录 Cursor。请先运行以下命令完成登录后重试:" >&2
    echo "" >&2
    echo "    ${AGENT_BIN} login" >&2
    echo "" >&2
    echo "或设置环境变量 CURSOR_API_KEY 后重新运行本脚本。" >&2
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# worker 名称：CURSOR_WORKER_NAME > 主机名 > "my-mac"
# ---------------------------------------------------------------------------
WORKER_NAME="${CURSOR_WORKER_NAME:-}"
if [[ -z "${WORKER_NAME}" ]]; then
  WORKER_NAME="$(hostname -s 2>/dev/null || hostname 2>/dev/null || true)"
fi
if [[ -z "${WORKER_NAME}" ]]; then
  WORKER_NAME="my-mac"
fi

echo "==> worker 名称: ${WORKER_NAME}"
echo "==> 工作目录:    ${REPO_ROOT}"

# ---------------------------------------------------------------------------
# 预检模式（--debug）：只跑诊断，不启动 worker
# ---------------------------------------------------------------------------
if [[ "${DEBUG_MODE}" -eq 1 ]]; then
  echo "==> 运行 worker 预检 (agent worker debug) ..."
  exec "${AGENT_BIN}" worker debug
fi

# ---------------------------------------------------------------------------
# 启动 worker（前台运行，Ctrl+C 停止）
# ---------------------------------------------------------------------------
echo "==> 启动 worker，Cloud Agents 的工具调用将在本机执行。按 Ctrl+C 停止。"
exec "${AGENT_BIN}" worker start \
  --name "${WORKER_NAME}" \
  --worker-dir "${REPO_ROOT}"
