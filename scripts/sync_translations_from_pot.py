#!/usr/bin/env python3
"""
从 raven/locale/main.pot 提取 msgid，并与现有 zh.csv 合并，输出或更新简体中文翻译文件。

用法:
  # 仅列出当前 POT 中的 msgid（用于检查缺失翻译）
  python scripts/sync_translations_from_pot.py --list-missing

  # 生成空白 zh.csv 模板（仅 source, 无翻译），便于批量翻译
  python scripts/sync_translations_from_pot.py --export-template -o raven/translations/zh_template.csv

  # 从 POT 提取 msgid 并合并到已有 zh.csv，保留已有翻译，新增条目留空
  python scripts/sync_translations_from_pot.py --merge

依赖: 无（仅标准库）。需在项目根目录执行。
"""

import argparse
import csv
import os
import sys
from pathlib import Path

# 项目根 = 脚本所在目录的上一级
ROOT = Path(__file__).resolve().parent.parent
POT_PATH = ROOT / "raven" / "locale" / "main.pot"
TRANSLATIONS_DIR = ROOT / "raven" / "translations"
ZH_CSV = TRANSLATIONS_DIR / "zh.csv"


def parse_pot(path: Path) -> list[str]:
    """从 .pot 文件解析所有 msgid（含多行）。"""
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


def read_zh_csv(path: Path) -> dict[str, tuple[str, str]]:
    """读取 zh.csv，返回 { source: (translation, context) }。"""
    if not path.exists():
        return {}
    out = {}
    with open(path, "r", encoding="utf-8", newline="") as f:
        for row in csv.reader(f):
            if len(row) >= 2:
                src = row[0].replace("\\n", "\n")
                trans = row[1].replace("\\n", "\n")
                ctx = row[2] if len(row) >= 3 else ""
                out[src] = (trans, ctx)
    return out


def write_zh_csv(path: Path, rows: list[tuple[str, str, str]]) -> None:
    """写入 zh.csv。每行 (source, translation, context)。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        for src, trans, ctx in rows:
            w.writerow([src, trans, ctx])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--list-missing", action="store_true", help="列出 POT 中有但 zh.csv 中未翻译的 msgid 数量")
    parser.add_argument("--export-template", action="store_true", help="导出仅含 source 的 CSV 模板")
    parser.add_argument("-o", "--output", type=Path, default=ZH_CSV, help="输出 CSV 路径")
    parser.add_argument("--merge", action="store_true", help="用 POT 的 msgid 合并到 zh.csv，保留已有翻译")
    args = parser.parse_args()

    if not POT_PATH.exists():
        print(f"POT 文件不存在: {POT_PATH}", file=sys.stderr)
        sys.exit(1)

    msgids = parse_pot(POT_PATH)
    print(f"POT 中共 {len(msgids)} 个 msgid")

    if args.list_missing:
        existing = read_zh_csv(ZH_CSV)
        missing = [m for m in msgids if m not in existing or not (existing[m][0].strip())]
        print(f"zh.csv 中未翻译或缺失: {len(missing)} 条")
        for m in missing[:30]:
            print(f"  - {m[:70]}...")
        if len(missing) > 30:
            print(f"  ... 共 {len(missing)} 条")
        return

    if args.export_template:
        rows = [(m, "", "") for m in msgids]
        write_zh_csv(args.output, rows)
        print(f"已写入模板: {args.output}")
        return

    if args.merge:
        existing = read_zh_csv(ZH_CSV)
        # 仅保留：仍在 POT 中且已有非空翻译的条目（不写入空翻译，避免界面显示空白）
        pot_set = set(msgids)
        rows = []
        for src, (trans, ctx) in existing.items():
            if src in pot_set and trans.strip():
                rows.append((src, trans, ctx))
        write_zh_csv(args.output, rows)
        print(f"已合并写入: {args.output}，共 {len(rows)} 条（POT 共 {len(msgids)} 条）")
        return

    parser.print_help()


if __name__ == "__main__":
    main()
