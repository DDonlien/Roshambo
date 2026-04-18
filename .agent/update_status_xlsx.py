import json
import shutil
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

xlsx_path = Path("/Users/taobe/Documents/GitHub/Roshambo/reference/Balatro_Items_Reference_Roshambo.xlsx")
base = Path("/Users/taobe/Documents/GitHub/Roshambo/ts/public/definition")
ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ET.register_namespace("", ns["a"])

implemented_sleeves = {
    item["name"]
    for item in json.loads((base / "sleevedefinition.json").read_text(encoding="utf-8"))["sleeves"]
}
implemented_gifts = {
    item["name"]
    for item in json.loads((base / "giftcarddefinition.json").read_text(encoding="utf-8"))["giftcards"]
}
implemented_playmats = {
    item["name"]
    for item in json.loads((base / "playmatdefinition.json").read_text(encoding="utf-8"))["playmats"]
}
implemented_sheet2 = implemented_gifts | implemented_playmats


def parse_shared(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    return [
        "".join(t.text or "" for t in si.iterfind(".//a:t", ns))
        for si in root.findall("a:si", ns)
    ]


def get_value(cell: ET.Element, shared: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//a:t", ns))
    value = cell.find("a:v", ns)
    if value is None:
        return ""
    return shared[int(value.text)] if cell_type == "s" else (value.text or "")


def make_inline_cell(ref: str, text: str) -> ET.Element:
    cell = ET.Element(f"{{{ns['a']}}}c", {"r": ref, "t": "inlineStr"})
    is_node = ET.SubElement(cell, f"{{{ns['a']}}}is")
    text_node = ET.SubElement(is_node, f"{{{ns['a']}}}t")
    text_node.text = text
    return cell


def update_sheet(xml_bytes: bytes, shared: list[str], status_for_name) -> bytes:
    root = ET.fromstring(xml_bytes)
    rows = root.findall(".//a:sheetData/a:row", ns)
    max_row = 1

    for row in rows:
        row_num = int(row.attrib.get("r", "1"))
        max_row = max(max_row, row_num)
        existing_columns = {cell.attrib.get("r", "")[:1] for cell in row.findall("a:c", ns)}
        if "J" in existing_columns:
            continue

        if row_num == 1:
            row.append(make_inline_cell(f"J{row_num}", "开发状态"))
            continue

        values = {cell.attrib.get("r", "")[:1]: get_value(cell, shared) for cell in row.findall("a:c", ns)}
        name_en = values.get("C", "")
        row.append(make_inline_cell(f"J{row_num}", status_for_name(name_en)))

    dimension = root.find("a:dimension", ns)
    if dimension is not None:
        dimension.attrib["ref"] = f"A1:J{max_row}"

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


with zipfile.ZipFile(xlsx_path, "r") as zin:
    shared = parse_shared(zin)
    files = {name: zin.read(name) for name in zin.namelist()}

files["xl/worksheets/sheet1.xml"] = update_sheet(
    files["xl/worksheets/sheet1.xml"],
    shared,
    lambda name: "已开发未测试" if name in implemented_sleeves else "未开发",
)
files["xl/worksheets/sheet2.xml"] = update_sheet(
    files["xl/worksheets/sheet2.xml"],
    shared,
    lambda name: "已开发未测试" if name in implemented_sheet2 else "未开发",
)
files["xl/worksheets/sheet3.xml"] = update_sheet(
    files["xl/worksheets/sheet3.xml"],
    shared,
    lambda _name: "未开发",
)

tmp_path = xlsx_path.with_suffix(".tmp.xlsx")
with zipfile.ZipFile(tmp_path, "w", compression=zipfile.ZIP_DEFLATED) as zout:
    for name, data in files.items():
        zout.writestr(name, data)

shutil.move(tmp_path, xlsx_path)
print(f"updated {xlsx_path}")
