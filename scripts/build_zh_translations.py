#!/usr/bin/env python3
"""
根据 raven/locale/main.pot 与内置的英->简中词典，生成/更新 raven/translations/zh.csv。
仅输出有翻译的条目；未在词典中的 msgid 不写入（Frappe 会回退到英文）。
在项目根目录执行。
"""

import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POT_PATH = ROOT / "raven" / "locale" / "main.pot"
ZH_CSV = ROOT / "raven" / "translations" / "zh.csv"

# 英文 -> 简体中文（仅列出有翻译的；占位符 {0}/{1} 等保持原样）
ZH_MAP = {
    "AI": "AI",
    "Action Name": "操作名称",
    "Add description": "添加描述",
    "Add users": "添加用户",
    "Add Users to Raven": "将用户添加到 Raven",
    "Allow Bot to Write Documents": "允许机器人写入文档",
    "Allow notifications": "允许通知",
    "Appearance": "外观",
    "Are you sure you want to remove this image?": "确定要移除此图片吗？",
    "Attach File to Document": "将文件附加到文档",
    "Attendance and Leaves": "考勤与请假",
    "Automatically Create a Channel for each Department": "为每个部门自动创建频道",
    "Automatically add system users to Raven": "自动将系统用户加入 Raven",
    "Automatically create channels for departments": "为部门自动创建频道",
    "Availability Status": "在线状态",
    "Available": "在线",
    "Away": "离开",
    "A channel with this name already exists in this workspace.": "该工作区中已存在同名频道。",
    "AI Integration is not enabled": "未启用 AI 集成",
    "Blurhash": "模糊哈希",
    "Bot Functions": "机器人功能",
    "Bot Name": "机器人名称",
    "Bot is mandatory": "必须选择机器人",
    "Bot model is not configured": "未配置机器人模型",
    "Bots": "机器人",
    "CRON Expression": "CRON 表达式",
    "Cancel": "取消",
    "Channel created": "频道已创建",
    "Channel description": "频道描述",
    "Channel description updated": "频道描述已更新",
    "Channel name can only contain letters, numbers and hyphens.": "频道名称只能包含字母、数字和连字符。",
    "Channel name cannot be less than {0} characters.": "频道名称不能少于 {0} 个字符。",
    "Channel name cannot be more than {0} characters.": "频道名称不能超过 {0} 个字符。",
    "Channel Type": "频道类型",
    "Channels": "频道",
    "Channels are where your team communicates. They are best when organized around a topic - #development, for example.": "频道是团队沟通的地方，建议按主题组织，例如 #开发。",
    "Chat Layout": "聊天布局",
    "Chat Style": "聊天风格",
    "Checkbox": "复选框",
    "Choose workspaces based on companies": "按公司选择工作区",
    "Company": "公司",
    "Company Workspace Mapping": "公司工作区映射",
    "Company is required": "请选择公司",
    "Configure how you want the app to look.": "配置您希望应用的外观。",
    "Configure the push notification service here.": "在此配置推送通知服务。",
    "Configure your preferences.": "配置您的偏好。",
    "Connect your HR system to Raven to sync employee data and send notifications.": "将 HR 系统连接到 Raven，以同步员工数据并发送通知。",
    "Could not create channel": "无法创建频道",
    "Create Document": "创建文档",
    "Create a private channel": "创建私有频道",
    "Create an open channel": "创建开放频道",
    "Create a public channel": "创建公开频道",
    "Create Channel": "创建频道",
    "Create Workspace": "创建工作区",
    "Custom Status": "自定义状态",
    "Description": "描述",
    "Disable Notifications": "关闭通知",
    "Do not disturb": "请勿打扰",
    "Edit description": "编辑描述",
    "Enable Code Interpreter": "启用代码解释器",
    "Enable Notifications": "开启通知",
    "Enabling...": "正在开启…",
    "Error sending message": "发送消息失败",
    "Expand": "展开",
    "Collapse": "收起",
    "Full Name": "姓名",
    "HR": "人力资源",
    "HR is not installed on this site.": "本站未安装 HR。",
    "Image uploaded successfully.": "图片上传成功。",
    "Invalid option selected.": "所选选项无效。",
    "Invisible": "隐身",
    "Is Admin": "是管理员",
    "Log Out": "退出登录",
    "Manage your Raven profile": "管理您的 Raven 资料",
    "Maximum file size: {0}MB": "最大文件大小：{0}MB",
    "Members": "成员",
    "Message sent": "消息已发送",
    "Mobile App": "移动应用",
    "Name": "名称",
    "Name cannot be more than {0} characters.": "姓名不能超过 {0} 个字符。",
    "Name is required": "请填写姓名",
    "No channels found": "未找到频道",
    "No channels in this workspace.": "此工作区暂无频道。",
    "Open": "开放",
    "Open command menu": "打开命令菜单",
    "Options": "选项",
    "optional": "选填",
    "Pin": "置顶",
    "Pinned": "已置顶",
    "Please add a channel name": "请输入频道名称",
    "Preferences": "偏好设置",
    "Profile": "个人资料",
    "Profile updated": "资料已更新",
    "Profile update failed": "资料更新失败",
    "Public": "公开",
    "Private": "私有",
    "Push Notifications": "推送通知",
    "Push Notification Service": "推送通知服务",
    "Push notifications disabled": "已关闭推送通知",
    "Push notifications enabled": "已开启推送通知",
    "Raven": "Raven",
    "Raven Cloud": "Raven Cloud",
    "Raven Settings": "Raven 设置",
    "Raven User": "Raven 用户",
    "Remove Image": "移除图片",
    "Remove Pin": "取消置顶",
    "Removing": "正在移除",
    "Reset": "重置",
    "Save": "保存",
    "Saving": "保存中",
    "Select Attachments": "选择附件",
    "Send": "发送",
    "Send a Raven": "发送 Raven",
    "Set Availability": "设置在线状态",
    "Set a custom status": "设置自定义状态",
    "Set custom status": "设置自定义状态",
    "Settings": "设置",
    "Settings updated": "设置已更新",
    "Share what you are up to": "分享您正在做什么",
    "Share what you're up to": "分享您正在做什么",
    "Show if a user is on leave": "显示用户请假状态",
    "Supported formats: {0}, {1}, {2}": "支持格式：{0}、{1}、{2}",
    "There was an error": "发生错误",
    "There was an error.": "发生错误。",
    "This is how people will know what this channel is about.": "这样大家就能了解这个频道的用途。",
    "Toggle theme": "切换主题",
    "Uh Oh! {0} exceeded the maximum file size required.": "抱歉，{0} 超过允许的最大文件大小。",
    "Unread": "未读",
    "Upload": "上传",
    "Uploading": "上传中",
    "View mentions": "查看@提及",
    "View Results": "查看结果",
    "View Votes": "查看投票",
    "When a channel is set to private, it can only be viewed or joined by invitation.": "频道设为私有后，仅可通过邀请查看或加入。",
    "When a channel is set to open, everyone is a member.": "频道设为开放时，所有人均为成员。",
    "When a channel is set to public, anyone can join the channel and read messages, but only members can post messages.": "频道设为公开时，任何人可加入并阅读消息，仅成员可发送消息。",
    "When a workspace is set to private, it can only be viewed or joined by invitation.\nWhen a workspace is set to public, anyone can join the workspace and view it's channels.": "工作区设为私有时，仅可通过邀请查看或加入；设为公开时，任何人可加入并查看其频道。",
    "You need to be a System Manager to manage the mobile app configuration.": "需要系统管理员权限才能管理移动应用配置。",
    "You need to be a System Manager to manage the push notification service.": "需要系统管理员权限才能管理推送通知服务。",
    "choose file": "选择文件",
    "Drag and drop your file here or": "将文件拖放到此处，或",
    "File size is larger than the required size.": "文件大小超过允许范围。",
    "Department Channel Type": "部门频道类型",
    "If checked, a channel will be created for each department. Employees in the department will be synced with channel members.": "若勾选，将为每个部门创建频道，部门员工将同步为频道成员。",
    "If checked, users on Raven are notified if another user is on leave.": "若勾选，当有用户请假时，Raven 上的用户会收到通知。",
    "Status cannot be more than {0} characters.": "状态不能超过 {0} 个字符。",
    "Status cannot be more than {} characters.": "状态不能超过指定字符数。",
    "Add": "添加",
    "Workspace": "工作区",
    "Workspace is required": "请选择工作区",
    "Actions": "操作",
    "Do more with Raven on your mobile.": "在手机上使用 Raven 做更多事。",
    "Anonymous": "匿名",
    "This poll will end on {0}.": "此投票将于 {0} 结束。",
    "vote": "票",
    "votes": "票",
    "View Results": "查看结果",
    "To view the poll results, please submit your choice(s)": "请先提交您的选择以查看投票结果",
    "This poll is closed and no longer accepting votes": "此投票已结束，不再接受投票",
    "Channel description": "频道描述",
    "Edit description": "编辑描述",
    "Discard": "放弃",
    # 常用后端/界面
    "Raven Channel": "Raven 频道",
    "Raven User": "Raven 用户",
    "Raven Workspace": "Raven 工作区",
    "Raven Bot": "Raven 机器人",
    "Raven Settings": "Raven 设置",
    "Raven Message": "Raven 消息",
    "Raven Poll": "Raven 投票",
    "Raven Admin": "Raven 管理员",
    "Raven Users": "Raven 用户",
    "Channel Name": "频道名称",
    "Channel Description": "频道描述",
    "Channel ID": "频道 ID",
    "Pinned Channels": "置顶频道",
    "Pinned Messages": "置顶消息",
    "Direct Message": "私信",
    "Direct Messages": "私信",
    "Message Actions": "消息操作",
    "Message Reactions": "消息反应",
    "Instruction": "说明",
    "Instruction Templates": "说明模板",
    "Functions": "功能",
    "Parameters": "参数",
    "Required": "必填",
    "Option": "选项",
    "Question": "问题",
    "Poll Question": "投票问题",
    "Poll Options": "投票选项",
    "Get Document": "获取文档",
    "Get List": "获取列表",
    "Create Document": "创建文档",
    "Submit Document": "提交文档",
    "Cancel Document": "取消文档",
    "Get Value": "获取值",
    "Send Message": "发送消息",
    "OpenAI": "OpenAI",
    "Model": "模型",
    "Temperature": "温度",
    "high": "高",
    "medium": "中",
    "low": "低",
    "string": "字符串",
    "number": "数字",
    "integer": "整数",
    "float": "浮点数",
    "boolean": "布尔",
    "Simple": "简洁",
    "Left-Right": "左右",
    "Go to Raven": "前往 Raven",
    "Raven is setup!": "Raven 已就绪！",
    "Simple, work messaging tool": "简洁的团队消息工具",
}


def parse_pot(path: Path) -> list[str]:
    msgids = []
    current: list[str] = []
    in_msgid = False
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("msgid "):
                in_msgid = True
                s = line[6:].strip().strip('"').replace("\\n", "\n").replace("\\\\", "\\")
                current = [s]
            elif in_msgid and line.startswith('"'):
                current[0] += line.strip().strip('"').replace("\\n", "\n").replace("\\\\", "\\")
            elif line.startswith("msgstr "):
                in_msgid = False
                if current and current[0]:
                    msgids.append(current[0])
                current = []
    return msgids


def main() -> None:
    if not POT_PATH.exists():
        print(f"POT 不存在: {POT_PATH}", file=sys.stderr)
        sys.exit(1)
    msgids = parse_pot(POT_PATH)
    rows = []
    for src in msgids:
        trans = ZH_MAP.get(src, "").strip()
        if trans:
            rows.append((src, trans, ""))
    ZH_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(ZH_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        for r in rows:
            w.writerow(r)
    print(f"已写入 {len(rows)} 条翻译到 {ZH_CSV}（POT 共 {len(msgids)} 条）")


if __name__ == "__main__":
    main()
