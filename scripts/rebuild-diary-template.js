/* eslint-disable @typescript-eslint/no-require-imports */
// One-off: rebuild templates/diary_template.xlsx 【テンプレート】 sheet to the
// 10-column layout (No / 名前 / 出欠 / 昼食 / 行 / 帰 / 様子(work) / コメント(work)
// / 様子(life) / コメント(life)).
const ExcelJS = require("exceljs");
const path = require("path");

(async () => {
  const file = path.join(__dirname, "..", "templates", "diary_template.xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  const old = wb.getWorksheet("【テンプレート】");
  if (old) wb.removeWorksheet(old.id);
  const ws = wb.addWorksheet("【テンプレート】");

  ws.columns = [
    { width: 4 },   // 1 No
    { width: 14 },  // 2 名前
    { width: 6 },   // 3 出欠
    { width: 6 },   // 4 昼食
    { width: 5 },   // 5 行
    { width: 5 },   // 6 帰
    { width: 22 },  // 7 様子(work)
    { width: 28 },  // 8 コメント(work)
    { width: 22 },  // 9 様子(life)
    { width: 28 },  // 10 コメント(life)
  ];

  const thin = { style: "thin", color: { argb: "FF888888" } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  // Row 1: title
  ws.getCell("A1").value = "サービス提供記録　兼　日誌";
  ws.mergeCells("A1:J1");
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getRow(1).height = 26;

  // Row 2: date | weekday | service type
  ws.getCell("A2").value = "【テンプレート】";
  ws.mergeCells("A2:B2");
  ws.getCell("C2").value = "（　）";
  ws.mergeCells("C2:D2");
  ws.getCell("E2").value = "就労継続支援Ｂ型";
  ws.mergeCells("E2:J2");
  ws.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell("C2").alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell("E2").alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell("A2").font = { bold: true, size: 12 };
  ws.getCell("E2").font = { bold: true, size: 11 };
  ws.getRow(2).height = 22;

  // Row 3: legend
  ws.getCell("A3").value =
    "出欠：○＝出席　△＝遅刻・早退　●＝欠席　／　昼食：○＝あり　●＝なし　／　送迎：行・帰それぞれ ○＝あり　●＝なし";
  ws.mergeCells("A3:J3");
  ws.getCell("A3").alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  ws.getCell("A3").font = { size: 9 };
  ws.getRow(3).height = 18;

  // Row 4: top headers
  ws.getCell(4, 1).value = "No.";
  ws.getCell(4, 2).value = "名前";
  ws.getCell(4, 3).value = "出欠";
  ws.getCell(4, 4).value = "昼食";
  ws.getCell(4, 5).value = "送迎";
  ws.mergeCells(4, 5, 4, 6);
  ws.getCell(4, 7).value = "職業指導員";
  ws.mergeCells(4, 7, 4, 8);
  ws.getCell(4, 9).value = "生活支援員";
  ws.mergeCells(4, 9, 4, 10);

  // Row 5: subheaders
  ws.getCell(5, 1).value = "";
  ws.getCell(5, 2).value = "";
  ws.getCell(5, 3).value = "";
  ws.getCell(5, 4).value = "";
  ws.getCell(5, 5).value = "行";
  ws.getCell(5, 6).value = "帰";
  ws.getCell(5, 7).value = "様子";
  ws.getCell(5, 8).value = "コメント";
  ws.getCell(5, 9).value = "様子";
  ws.getCell(5, 10).value = "コメント";

  for (const r of [4, 5]) {
    for (let c = 1; c <= 10; c++) {
      const cell = ws.getCell(r, c);
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
      cell.border = border;
    }
  }
  ws.getRow(4).height = 22;
  ws.getRow(5).height = 20;

  // Rows 6-19: 14 client rows
  for (let r = 6; r <= 19; r++) {
    for (let c = 1; c <= 10; c++) {
      const cell = ws.getCell(r, c);
      cell.border = border;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.font = { size: 10 };
    }
    // Left-align name and comment columns
    ws.getCell(r, 2).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    ws.getCell(r, 7).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    ws.getCell(r, 8).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    ws.getCell(r, 9).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    ws.getCell(r, 10).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    ws.getRow(r).height = 44;
  }

  // Row 20: 午前 作業内容
  ws.getCell("A20").value = "午前";
  ws.getCell("B20").value = "作業内容：";
  ws.mergeCells("C20:J20");
  ws.getRow(20).height = 28;

  // Row 21: 午後 作業内容
  ws.getCell("A21").value = "午後";
  ws.getCell("B21").value = "作業内容：";
  ws.mergeCells("C21:J21");
  ws.getRow(21).height = 28;

  // Row 22: 備考
  ws.getCell("A22").value = "備考";
  ws.mergeCells("B22:J22");
  ws.getRow(22).height = 50;

  // Row 23: signatures
  ws.getCell("A23").value = "担当者：";
  ws.mergeCells("A23:D23");
  ws.getCell("E23").value = "サービス管理責任者確認：";
  ws.mergeCells("E23:G23");
  ws.getCell("H23").value = "確認日：　　　年　　月　　日";
  ws.mergeCells("H23:J23");
  ws.getRow(23).height = 26;

  for (let r = 20; r <= 23; r++) {
    for (let c = 1; c <= 10; c++) {
      const cell = ws.getCell(r, c);
      cell.border = border;
      cell.alignment = cell.alignment ?? { vertical: "middle" };
      if (!cell.alignment.vertical) cell.alignment.vertical = "middle";
      cell.font = cell.font ?? { size: 10 };
    }
  }

  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    paperSize: 9, // A4
    margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };

  await wb.xlsx.writeFile(file);
  console.log("Rebuilt", file);
})();
