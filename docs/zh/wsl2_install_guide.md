# Skill: WSL2环境下安装DeepScientist并配置阿里百炼Coding Plan

> 本指南适用于 Windows 10/11 用户，通过 WSL2 将 DeepScientist 完整安装到 D 盘（系统盘），并使用阿里百炼 Coding Plan API Key 调用通义千问模型。所有步骤均经过验证，可复现。

---

## 📦 前置条件

- Windows 10/11（版本 2004+，内部版本 19041+）
- 阿里百炼 **Coding Plan** API Key（密钥形如 `sk-sp-xxx`，**不是**普通 DashScope API Key）
- 稳定的网络（如遇 GitHub 或 astral.sh 下载失败，建议配置代理或使用镜像）

---

## 🧱 第一步：安装 WSL2 并迁移到 D 盘

### 1.1 启用 WSL 功能（管理员 PowerShell）

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

### 1.2 重启电脑

### 1.3 下载并安装 WSL2 内核更新包

从 [微软官网](https://aka.ms/wsl2kernel) 下载 `wsl.2.6.3.0.x64.msi`，双击安装。

### 1.4 设置 WSL2 为默认版本

```powershell
wsl --set-default-version 2
```

### 1.5 安装 Ubuntu 并指定到 D 盘（使用导出导入法）

由于部分旧版 WSL 不支持 `--location` 参数，采用以下通用方法：

```powershell
# 1. 临时安装到默认位置（C盘）
wsl --install -d Ubuntu

# 2. 重启后完成 Ubuntu 初始化（设置用户名密码）

# 3. 导出并迁移到 D 盘
wsl --export Ubuntu D:\WSL\Ubuntu.tar
wsl --unregister Ubuntu
mkdir D:\WSL\Ubuntu
wsl --import Ubuntu D:\WSL\Ubuntu D:\WSL\Ubuntu.tar --version 2

# 4. 设置默认用户（将 <your_username> 替换为初始化时的用户名）
ubuntu config --default-user <your_username>

# 5. 删除备份文件
del D:\WSL\Ubuntu.tar
```

验证：`wsl -l -v` 应显示 Ubuntu 的 VERSION 为 2，且 `D:\WSL\Ubuntu\ext4.vhdx` 存在。

---

## 🐧 第二步：进入 WSL 并准备基础环境

启动 WSL：

```powershell
wsl -d Ubuntu
```

更新系统并安装必要工具：

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git
```

---

## 📂 第三步：配置 npm 全局路径到用户目录（避免 sudo）

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

---

## 🟢 第四步：安装 DeepScientist 和 Codex CLI（固定版本）

```bash
npm install -g @researai/deepscientist
npm install -g @openai/codex@0.57.0
```

验证：

```bash
codex --version   # 必须显示 codex-cli 0.57.0
ds --version      # 显示版本号
```

---

## 🔑 第五步：配置阿里百炼 Coding Plan

### 5.1 设置 API Key 环境变量

编辑 `~/.bashrc`：

```bash
nano ~/.bashrc
```

在末尾添加：

```bash
export OPENAI_API_KEY="sk-sp-你的真实API密钥"
```

保存后执行 `source ~/.bashrc`。

### 5.2 创建 Codex 配置文件（含 profile）

```bash
mkdir -p ~/.codex
cat > ~/.codex/config.toml << 'EOF'
model = "qwen3.5-plus"
model_provider = "Model_Studio_Coding_Plan"

[model_providers.Model_Studio_Coding_Plan]
name = "Model_Studio_Coding_Plan"
base_url = "https://coding.dashscope.aliyuncs.com/v1"
env_key = "OPENAI_API_KEY"
wire_api = "chat"

[profiles.bailian]
model = "qwen3.5-plus"
model_provider = "Model_Studio_Coding_Plan"
EOF
```

### 5.3 测试 Codex 是否可用

```bash
codex --profile bailian
```

在出现的 `>` 提示符后输入 `你好`，应收到模型回复。输入 `exit` 退出。

---

## 🌐 第六步：安装 uv（DeepScientist 依赖的 Python 运行时管理器）

```bash
curl -LsSf https://github.com/astral-sh/uv/releases/latest/download/uv-installer.sh | sh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
uv --version   # 验证
```

---

## 🧪 第七步：运行诊断并启动 DeepScientist

### 7.1 诊断

```bash
ds doctor --codex-profile bailian
```

所有检查项应为 `[ok]` 或 `[warn]`（可忽略 Git 用户名和 LaTeX 警告）。

### 7.2 启动服务

```bash
mkdir -p ~/my_research && cd ~/my_research
ds --here --codex-profile bailian
```

启动成功后终端显示：

```
Local web UI: http://127.0.0.1:20999
```

### 7.3 在 Windows 浏览器中访问

打开 Chrome / Edge，访问 `http://127.0.0.1:20999`，点击 **Start Research** 开始你的 AI 科研。

---

## 🛑 停止 DeepScientist

在 WSL 终端中按 `Ctrl+C`，或执行：

```bash
ds --stop
```

---

## 🔧 常见问题速查

| 现象 | 解决方法 |
|------|----------|
| `wsl --import` 报 `HCS_E_HYPERV_NOT_INSTALLED` | BIOS 开启虚拟化，执行 `bcdedit /set hypervisorlaunchtype auto` 并重启 |
| `npm install -g` 权限错误 | 按第三步配置 npm 全局路径到用户目录 |
| `ds doctor` 提示 Codex 版本不兼容 | 确认已安装 `@openai/codex@0.57.0` |
| Codex 测试正常但 DeepScientist 启动失败 | 确保使用 `--codex-profile bailian` 参数启动 |
| `wire_api = "chat"` 弃用警告 | 可忽略，不影响使用；未来可改为 `responses`（需阿里云支持） |
| 下载 uv 失败 | 配置代理或手动安装：`pip install uv --user` |

---

## 📎 附录：可选优化

- **配置 Git 信息**（避免警告）：
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "you@example.com"
  ```

- **安装 LaTeX**（生成论文 PDF）：
  ```bash
  sudo apt install -y texlive-latex-base texlive-latex-recommended texlive-fonts-recommended texlive-bibtex-extra
  ```
  或使用 DeepScientist 内置 TinyTeX：`ds latex install-runtime`

- **设置默认 profile**：编辑 `~/my_research/DeepScientist/config/runners.yaml`，将 `profile: bailian` 写入 `codex` 段。

---

## 🧠 致开发者

本 Skill 已在以下环境验证通过：
- Windows 10 22H2 (19045.6456)
- WSL2 Ubuntu 22.04.5 LTS
- Node.js 20.x, npm 10.8.2
- Codex CLI 0.57.0
- DeepScientist 1.5.17
- 阿里百炼 Coding Plan API（qwen3.5-plus）

所有步骤均可脚本化，建议开发者可考虑提供一键安装脚本（如 `install.sh`），自动完成 npm 配置、Codex 降级、uv 安装及 profile 生成。

---

**现在，你的 DeepScientist 已经成功运行在 D 盘，并使用阿里云千问模型。** 享受自动化的科研之旅吧！