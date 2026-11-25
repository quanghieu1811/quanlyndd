import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
} from 'docx';

export async function downloadDocxBlob(doc: Document, filename: string) {
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Table cell border styling helpers
const noBorder = {
  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
};

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '334155' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '334155' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '334155' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '334155' },
};

// 1. EXPORT WEEKLY CLASS REPORT (.DOCX) - MẪU 1
export async function exportWeeklyReportDocx(options: {
  schoolName: string;
  className: string;
  academicYear: string;
  weekNum: number;
  weekInfoText: string;
  locationText?: string;
  groupRankings: Array<{
    rank: number;
    groupNumber: number;
    studentCount: number;
    plus: number;
    minus: number;
    net: number;
    averageScore: number;
    titleText: string;
  }>;
  top10Students: Array<{
    rank: number;
    stt: number;
    name: string;
    group: number;
    plus: number;
    minus: number;
    net: number;
    honorTitle: string;
  }>;
  penalizedStudents: Array<{
    stt: number;
    name: string;
    group: number;
    minus: number;
    reasons: string;
    actionText: string;
  }>;
  teacherNote?: string;
  showTeacherNotes?: boolean;
  showSignatures?: boolean;
  signers: { loptruong: string; chidoitruong: string; gvcn: string };
}) {
  const {
    schoolName,
    className,
    academicYear,
    weekNum,
    weekInfoText,
    locationText = 'Bắc Ninh',
    groupRankings,
    top10Students,
    penalizedStudents,
    teacherNote,
    showTeacherNotes = true,
    showSignatures = true,
    signers,
  } = options;

  const today = new Date();

  // Header Table (Quốc hiệu tiêu ngữ & Tên trường/lớp)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: schoolName.toUpperCase(), bold: true, size: 19 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `CHI ĐỘI • ${className.toUpperCase()}`, bold: true, size: 18, color: '1E3A8A' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 19 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', italics: true, size: 18 })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 140 },
                children: [new TextRun({ text: `${locationText}, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`, italics: true, size: 16, color: '475569' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Title
  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 250, after: 80 },
    children: [
      new TextRun({
        text: `BÁO CÁO TỔNG KẾT THI ĐUA & NỀ NẾP TUẦN ${weekNum}`,
        bold: true,
        size: 26,
        color: '1E3A8A',
      }),
    ],
  });

  const subTitleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 250 },
    children: [
      new TextRun({
        text: `(Từ ngày ${weekInfoText} • Lớp ${className} • Năm học ${academicYear})`,
        italics: true,
        size: 18,
        color: '475569',
      }),
    ],
  });

  // Section 1 Heading
  const sec1Heading = new Paragraph({
    spacing: { before: 150, after: 80 },
    children: [
      new TextRun({ text: 'I. BẢNG XẾP LOẠI THI ĐUA 4 TỔ (TÍNH THEO ĐIỂM TRUNG BÌNH)', bold: true, size: 20, color: '1E3A8A' }),
    ],
  });

  // Group Rankings Table
  const groupTableRows = [
    new TableRow({
      cantSplit: true,
      children: ['HẠNG', 'ĐƠN VỊ TỔ', 'SĨ SỐ', 'ĐIỂM (+)', 'ĐIỂM (-)', 'TỔNG ĐIỂM', 'ĐTB TỔ', 'DANH HIỆU KHEN THƯỞNG'].map((headerText) => (
        new TableCell({
          shading: { fill: '1E3A8A', type: ShadingType.CLEAR, color: 'auto' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: headerText, bold: true, size: 16, color: 'FFFFFF' })],
            }),
          ],
        })
      )),
    }),
    ...groupRankings.map((g) => (
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `#${g.rank}`, bold: true, size: 17 })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: `Tổ ${g.groupNumber}`, bold: true, size: 17 })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${g.studentCount} HS`, size: 16 })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `+${g.plus}`, size: 17, color: '166534' })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `-${g.minus}`, size: 17, color: '991B1B' })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${g.net > 0 ? '+' : ''}${g.net}`, bold: true, size: 17 })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${g.averageScore > 0 ? '+' : ''}${g.averageScore} đ`, bold: true, size: 17, color: '1E3A8A' })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: g.titleText, bold: g.rank === 1, size: 16, color: g.rank === 1 ? 'B45309' : '334155' })] })],
          }),
        ],
      })
    )),
  ];

  const groupTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorder,
    rows: groupTableRows,
  });

  // Section 2 Heading
  const sec2Heading = new Paragraph({
    spacing: { before: 250, after: 80 },
    children: [
      new TextRun({ text: 'II. BẢNG VÀNG TOP 10 HỌC SINH XUẤT SẮC NHẤT TUẦN', bold: true, size: 20, color: '1E3A8A' }),
    ],
  });

  // Top 10 Student Table
  const top10TableRows = [
    new TableRow({
      cantSplit: true,
      children: ['HẠNG', 'STT', 'HỌ VÀ TÊN HỌC SINH', 'TỔ', 'THƯỞNG (+)', 'TRỪ (-)', 'ĐIỂM RÒNG', 'GHI NHẬN THI ĐUA'].map((headerText) => (
        new TableCell({
          shading: { fill: '047857', type: ShadingType.CLEAR, color: 'auto' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: headerText, bold: true, size: 16, color: 'FFFFFF' })],
            }),
          ],
        })
      )),
    }),
    ...top10Students.map((s) => (
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `#${s.rank}`, bold: true, size: 17 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `#${s.stt}`, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.name, bold: true, size: 17 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tổ ${s.group}`, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `+${s.plus}`, size: 17, color: '166534' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `-${s.minus}`, size: 17, color: '991B1B' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${s.net > 0 ? '+' : ''}${s.net} đ`, bold: true, size: 17, color: '047857' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.honorTitle, size: 16 })] })] }),
        ],
      })
    )),
  ];

  const top10Table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorder,
    rows: top10TableRows,
  });

  // Section 3 Heading
  const sec3Heading = new Paragraph({
    spacing: { before: 250, after: 80 },
    children: [
      new TextRun({ text: 'III. DANH SÁCH HỌC SINH CẦN RÈN LUYỆN & CHÉP PHẠT NỘI QUY', bold: true, size: 20, color: '991B1B' }),
    ],
  });

  let penalizedContent: Paragraph | Table;

  if (penalizedStudents.length === 0) {
    penalizedContent = new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: 'Tuần này toàn lớp nề nếp tốt, không có học sinh nào bị trừ trên 6 điểm hoặc vi phạm nội quy trường!',
          italics: true,
          size: 18,
          color: '166534',
        }),
      ],
    });
  } else {
    const penalizedRows = [
      new TableRow({
        cantSplit: true,
        children: ['STT', 'HỌ VÀ TÊN HỌC SINH', 'TỔ', 'ĐIỂM TRỪ', 'LỖI VI PHẠM CỤ THỂ', 'HÌNH THỨC RÈN LUYỆN'].map((headerText) => (
          new TableCell({
            shading: { fill: '991B1B', type: ShadingType.CLEAR, color: 'auto' },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: headerText, bold: true, size: 16, color: 'FFFFFF' })],
              }),
            ],
          })
        )),
      }),
      ...penalizedStudents.map((p) => (
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${p.stt}`, size: 17 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.name, bold: true, size: 17 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tổ ${p.group}`, size: 16 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `-${p.minus} đ`, bold: true, size: 17, color: '991B1B' })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.reasons, size: 16 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.actionText, bold: true, size: 16, color: '991B1B' })] })] }),
          ],
        })
      )),
    ];

    penalizedContent = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorder,
      rows: penalizedRows,
    });
  }

  // Section 4: Teacher Note
  const childrenElements: any[] = [
    headerTable,
    titleParagraph,
    subTitleParagraph,
    sec1Heading,
    groupTable,
    sec2Heading,
    top10Table,
    sec3Heading,
    penalizedContent,
  ];

  if (showTeacherNotes) {
    childrenElements.push(
      new Paragraph({
        spacing: { before: 250, after: 60 },
        children: [new TextRun({ text: 'IV. NHẬN XÉT VÀ PHƯƠNG HƯỚNG CỦA GIÁO VIÊN CHỦ NHIỆM', bold: true, size: 20, color: '1E3A8A' })],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: teacherNote || 'Không có nhận xét thêm.', italics: true, size: 18 })],
      })
    );
  }

  if (showSignatures) {
    const signatureTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'LỚP TRƯỞNG', bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký và ghi rõ họ tên)', italics: true, size: 15 })] }),
                new Paragraph({ spacing: { before: 750 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: signers.loptruong, bold: true, size: 18 })] }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BCH CHI ĐỘI', bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Xác nhận nề nếp)', italics: true, size: 15 })] }),
                new Paragraph({ spacing: { before: 750 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: signers.chidoitruong, bold: true, size: 18 })] }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'GIÁO VIÊN CHỦ NHIỆM', bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Duyệt và ký tên)', italics: true, size: 15 })] }),
                new Paragraph({ spacing: { before: 750 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: signers.gvcn, bold: true, size: 18 })] }),
              ],
            }),
          ],
        }),
      ],
    });
    childrenElements.push(new Paragraph({ spacing: { before: 200 } }), signatureTable);
  }

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: childrenElements,
      },
    ],
  });

  const filename = `Bao_Cao_Thi_Dua_Tuan_${weekNum}_${className.replace(/\s+/g, '_')}.docx`;
  await downloadDocxBlob(doc, filename);
}

// 2. EXPORT MONTHLY CLASS REPORT (.DOCX) - MẪU 2
export async function exportMonthlyReportDocx(options: {
  schoolName: string;
  className: string;
  academicYear: string;
  monthNum: number;
  monthLabel: string;
  theme: string;
  locationText?: string;
  groupRankings: Array<{
    rank: number;
    groupNumber: number;
    studentCount: number;
    plus: number;
    minus: number;
    net: number;
    averageScore: number;
    titleText: string;
  }>;
  topStudents: Array<{
    rank: number;
    name: string;
    group: number;
    netScore: number;
    plus: number;
    minus: number;
  }>;
  teacherNote?: string;
  showTeacherNotes?: boolean;
  showSignatures?: boolean;
  signers: { loptruong: string; chidoitruong: string; gvcn: string };
}) {
  const {
    schoolName,
    className,
    academicYear,
    monthNum,
    monthLabel,
    theme,
    locationText = 'Bắc Ninh',
    groupRankings,
    topStudents,
    teacherNote,
    showTeacherNotes = true,
    showSignatures = true,
    signers,
  } = options;

  const today = new Date();

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: schoolName.toUpperCase(), bold: true, size: 19 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${className.toUpperCase()} • NIÊN KHÓA ${academicYear}`, bold: true, size: 18, color: '1E3A8A' })] }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 19 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', italics: true, size: 18 })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 140 }, children: [new TextRun({ text: `${locationText}, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`, italics: true, size: 16, color: '475569' })] }),
            ],
          }),
        ],
      }),
    ],
  });

  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 250, after: 80 },
    children: [
      new TextRun({ text: `BÁO CÁO TỔNG KẾT VÀ XẾP LOẠI THI ĐUA THÁNG ${monthNum}`, bold: true, size: 26, color: '1E3A8A' }),
    ],
  });

  const subTitleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 250 },
    children: [
      new TextRun({ text: `(${monthLabel} • Chủ đề: ${theme} • Lớp ${className})`, italics: true, size: 18, color: '475569' }),
    ],
  });

  // Section 1: Group Monthly Rankings
  const sec1Heading = new Paragraph({
    spacing: { before: 150, after: 80 },
    children: [new TextRun({ text: 'I. BẢNG XẾP HẠNG THI ĐUA CÁC TỔ TRONG THÁNG', bold: true, size: 20, color: '1E3A8A' })],
  });

  const groupRows = [
    new TableRow({
      cantSplit: true,
      children: ['HẠNG', 'ĐƠN VỊ TỔ', 'THƯỞNG (+)', 'TRỪ (-)', 'ĐIỂM RÒNG', 'ĐTB THÁNG', 'DANH HIỆU THÁNG'].map((headerText) => (
        new TableCell({
          shading: { fill: '1E3A8A', type: ShadingType.CLEAR, color: 'auto' },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: headerText, bold: true, size: 16, color: 'FFFFFF' })] })],
        })
      )),
    }),
    ...groupRankings.map((g) => (
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `#${g.rank}`, bold: true, size: 17 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Tổ ${g.groupNumber}`, bold: true, size: 17 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `+${g.plus}`, size: 17, color: '166534' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `-${g.minus}`, size: 17, color: '991B1B' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${g.net > 0 ? '+' : ''}${g.net}`, bold: true, size: 17 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${g.averageScore > 0 ? '+' : ''}${g.averageScore} đ`, bold: true, size: 17, color: '1E3A8A' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: g.titleText, bold: g.rank === 1, size: 16 })] })] }),
        ],
      })
    )),
  ];

  const groupTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorder,
    rows: groupRows,
  });

  // Section 2: Top Students
  const sec2Heading = new Paragraph({
    spacing: { before: 250, after: 80 },
    children: [new TextRun({ text: 'II. BẢNG VẢNG TỔNG HỢP GƯƠNG MẶT XUẤT SẮC TRONG THÁNG', bold: true, size: 20, color: '1E3A8A' })],
  });

  const topStudentRows = [
    new TableRow({
      cantSplit: true,
      children: ['HẠNG', 'HỌ VÀ TÊN HỌC SINH', 'TỔ', 'THƯỞNG (+)', 'TRỪ (-)', 'ĐIỂM RÒNG THÁNG'].map((headerText) => (
        new TableCell({
          shading: { fill: '047857', type: ShadingType.CLEAR, color: 'auto' },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: headerText, bold: true, size: 16, color: 'FFFFFF' })] })],
        })
      )),
    }),
    ...topStudents.map((s) => (
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `#${s.rank}`, bold: true, size: 17 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.name, bold: true, size: 17 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tổ ${s.group}`, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `+${s.plus}`, size: 17, color: '166534' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `-${s.minus}`, size: 17, color: '991B1B' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${s.netScore > 0 ? '+' : ''}${s.netScore} đ`, bold: true, size: 17, color: '047857' })] })] }),
        ],
      })
    )),
  ];

  const topStudentTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorder,
    rows: topStudentRows,
  });

  const childrenElements: any[] = [
    headerTable,
    titleParagraph,
    subTitleParagraph,
    sec1Heading,
    groupTable,
    sec2Heading,
    topStudentTable,
  ];

  if (showTeacherNotes) {
    childrenElements.push(
      new Paragraph({
        spacing: { before: 250, after: 60 },
        children: [new TextRun({ text: 'III. LỜI DẶN VÀ PHƯƠNG HƯỚNG THÁNG TỚI CỦA GVCN', bold: true, size: 20, color: '1E3A8A' })],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: teacherNote || 'Các tổ đã duy trì tốt nề nếp thi đua trong tháng.', italics: true, size: 18 })],
      })
    );
  }

  if (showSignatures) {
    const signatureTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'LỚP TRƯỞNG', bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký và ghi rõ họ tên)', italics: true, size: 15 })] }),
                new Paragraph({ spacing: { before: 750 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: signers.loptruong, bold: true, size: 18 })] }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BCH CHI ĐỘI', bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký và ghi rõ họ tên)', italics: true, size: 15 })] }),
                new Paragraph({ spacing: { before: 750 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: signers.chidoitruong, bold: true, size: 18 })] }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'GIÁO VIÊN CHỦ NHIỆM', bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Duyệt và ký tên)', italics: true, size: 15 })] }),
                new Paragraph({ spacing: { before: 750 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: signers.gvcn, bold: true, size: 18 })] }),
              ],
            }),
          ],
        }),
      ],
    });
    childrenElements.push(new Paragraph({ spacing: { before: 200 } }), signatureTable);
  }

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: childrenElements,
      },
    ],
  });

  const filename = `Bao_Cao_Thi_Dua_Thang_${monthNum}_${className.replace(/\s+/g, '_')}.docx`;
  await downloadDocxBlob(doc, filename);
}

// 3. EXPORT GROUP LEDGER (.DOCX) - MẪU 3
export async function exportGroupLedgerDocx(options: {
  schoolName: string;
  className: string;
  academicYear: string;
  groupNumber: number;
  weekNum: number;
  groupLeaderName: string;
  locationText?: string;
  studentScores: Array<{
    stt: number;
    name: string;
    role: string;
    plus: number;
    minus: number;
    net: number;
    detailNotes: string;
  }>;
  showSignatures?: boolean;
  signers: { loptruong: string; totruong: string; gvcn: string };
}) {
  const {
    schoolName,
    className,
    academicYear,
    groupNumber,
    weekNum,
    groupLeaderName,
    locationText = 'Bắc Ninh',
    studentScores,
    showSignatures = true,
    signers,
  } = options;

  const today = new Date();

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: schoolName.toUpperCase(), bold: true, size: 19 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${className.toUpperCase()} • TỔ ${groupNumber}`, bold: true, size: 18, color: '1E3A8A' })] }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 19 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', italics: true, size: 18 })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 140 }, children: [new TextRun({ text: `${locationText}, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`, italics: true, size: 16, color: '475569' })] }),
            ],
          }),
        ],
      }),
    ],
  });

  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 250, after: 80 },
    children: [
      new TextRun({ text: `SỔ THEO DÕI ĐIỂM THI ĐUA TỔ ${groupNumber} - TUẦN ${weekNum}`, bold: true, size: 26, color: '1E3A8A' }),
    ],
  });

  const subTitleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 250 },
    children: [
      new TextRun({ text: `(Tổ trưởng: ${groupLeaderName} • Lớp ${className} • Niên khóa ${academicYear})`, italics: true, size: 18, color: '475569' }),
    ],
  });

  const tableRows = [
    new TableRow({
      cantSplit: true,
      children: ['STT', 'HỌ VÀ TÊN THÀNH VIÊN', 'CHỨC VỤ', 'THƯỞNG (+)', 'TRỪ (-)', 'ĐIỂM RÒNG', 'GHI CHÚ SỰ VỤ KHEN THƯỞNG / VI PHẠM'].map((headerText) => (
        new TableCell({
          shading: { fill: '1E3A8A', type: ShadingType.CLEAR, color: 'auto' },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: headerText, bold: true, size: 16, color: 'FFFFFF' })] })],
        })
      )),
    }),
    ...studentScores.map((s) => (
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${s.stt}`, size: 17 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.name, bold: true, size: 17 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.role || 'Tổ viên', size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: s.plus > 0 ? `+${s.plus}` : '-', size: 17, color: '166534' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: s.minus > 0 ? `-${s.minus}` : '-', size: 17, color: '991B1B' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${s.net > 0 ? '+' : ''}${s.net}`, bold: true, size: 17 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.detailNotes || 'Thực hiện tốt nội quy', italics: !s.detailNotes, size: 16, color: '475569' })] })] }),
        ],
      })
    )),
  ];

  const ledgerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorder,
    rows: tableRows,
  });

  const childrenElements: any[] = [
    headerTable,
    titleParagraph,
    subTitleParagraph,
    ledgerTable,
  ];

  if (showSignatures) {
    const signatureTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `TỔ TRƯỞNG TỔ ${groupNumber}`, bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký và ghi rõ họ tên)', italics: true, size: 15 })] }),
                new Paragraph({ spacing: { before: 750 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: signers.totruong || groupLeaderName, bold: true, size: 18 })] }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'LỚP TRƯỞNG', bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Duyệt sổ điểm)', italics: true, size: 15 })] }),
                new Paragraph({ spacing: { before: 750 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: signers.loptruong, bold: true, size: 18 })] }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'GIÁO VIÊN CHỦ NHIỆM', bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Phê duyệt)', italics: true, size: 15 })] }),
                new Paragraph({ spacing: { before: 750 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: signers.gvcn, bold: true, size: 18 })] }),
              ],
            }),
          ],
        }),
      ],
    });
    childrenElements.push(new Paragraph({ spacing: { before: 300 } }), signatureTable);
  }

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: childrenElements,
      },
    ],
  });

  const filename = `So_Diem_To_${groupNumber}_Tuan_${weekNum}_${className.replace(/\s+/g, '_')}.docx`;
  await downloadDocxBlob(doc, filename);
}

// 4. EXPORT PARENT CARDS REPORT (.DOCX) - MẪU 4
export async function exportParentCardsDocx(options: {
  schoolName: string;
  className: string;
  academicYear: string;
  weekNum: number;
  studentCards: Array<{
    stt: number;
    name: string;
    group: number;
    rank: number;
    plus: number;
    minus: number;
    net: number;
    plusList: string[];
    minusList: string[];
    teacherNote: string;
  }>;
  showTeacherNotes?: boolean;
  showSignatures?: boolean;
  signers: { gvcn: string };
}) {
  const {
    schoolName,
    className,
    academicYear,
    weekNum,
    studentCards,
    showTeacherNotes = true,
    showSignatures = true,
    signers,
  } = options;

  const childrenParagraphs: any[] = [];

  studentCards.forEach((card, index) => {
    // Header for individual card
    childrenParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: index > 0 ? 350 : 50, after: 60 },
        children: [
          new TextRun({ text: `${schoolName.toUpperCase()} • ${className.toUpperCase()}`, bold: true, size: 19 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({ text: `PHIẾU BÁO ĐIỂM RÈN LUYỆN & THI ĐUA - TUẦN ${weekNum}`, bold: true, size: 24, color: '1E3A8A' }),
        ],
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: `Họ và tên học sinh: `, bold: true, size: 18 }),
          new TextRun({ text: `${card.name}`, bold: true, size: 20, color: '1E3A8A' }),
          new TextRun({ text: ` (STT: #${card.stt} • Tổ ${card.group})`, size: 18 }),
          new TextRun({ text: `    • Xếp hạng tuần: `, bold: true, size: 18 }),
          new TextRun({ text: `#${card.rank}`, bold: true, size: 20, color: '047857' }),
        ],
      })
    );

    // Score Table
    const scoreTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR, color: 'auto' },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ĐIỂM CỘNG (+)', bold: true, size: 17, color: '166534' })] })],
            }),
            new TableCell({
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR, color: 'auto' },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ĐIỂM TRỪ (-)', bold: true, size: 17, color: '991B1B' })] })],
            }),
            new TableCell({
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR, color: 'auto' },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'TỔNG ĐIỂM RÒNG TUẦN', bold: true, size: 17, color: '1E3A8A' })] })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `+${card.plus} điểm`, bold: true, size: 19, color: '166534' })] })],
            }),
            new TableCell({
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `-${card.minus} điểm`, bold: true, size: 19, color: '991B1B' })] })],
            }),
            new TableCell({
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${card.net > 0 ? '+' : ''}${card.net} điểm`, bold: true, size: 20, color: '1E3A8A' })] })],
            }),
          ],
        }),
      ],
    });

    childrenParagraphs.push(scoreTable);

    // Detail Records
    if (card.plusList.length > 0 || card.minusList.length > 0) {
      childrenParagraphs.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [new TextRun({ text: 'Chi tiết các lượt ghi nhận thi đua:', bold: true, size: 17 })],
        })
      );
      card.plusList.forEach((item) => {
        childrenParagraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: `[Thưởng] ${item}`, size: 16, color: '166534' })],
          })
        );
      });
      card.minusList.forEach((item) => {
        childrenParagraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: `[Trừ] ${item}`, size: 16, color: '991B1B' })],
          })
        );
      });
    }

    if (showTeacherNotes) {
      childrenParagraphs.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [
            new TextRun({ text: 'Nhắc nhở của GVCN: ', bold: true, size: 17 }),
            new TextRun({ text: card.teacherNote || 'Mong em phát huy ưu điểm và thực hiện tốt nội quy!', italics: true, size: 17 }),
          ],
        })
      );
    }

    if (showSignatures) {
      childrenParagraphs.push(
        new Paragraph({
          spacing: { after: 300 },
          children: [
            new TextRun({ text: `Xác nhận của PHHS: ................................................................     Ký tên GVCN: `, size: 17 }),
            new TextRun({ text: `${signers.gvcn}`, bold: true, size: 17 }),
          ],
        })
      );
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: childrenParagraphs,
      },
    ],
  });

  const filename = `Phieu_Bao_Diem_Tuan_${weekNum}_${className.replace(/\s+/g, '_')}.docx`;
  await downloadDocxBlob(doc, filename);
}

// 5. EXPORT FULL CLASS LEDGER REPORT (.DOCX) - MẪU 5 (SỔ ĐIỂM THI ĐUA CHI TIẾT CẢ LỚP)
export async function exportClassLedgerDocx(options: {
  schoolName: string;
  className: string;
  academicYear: string;
  weekNum: number;
  locationText?: string;
  studentScores: Array<{
    stt: number;
    name: string;
    group: number;
    role?: string;
    plus: number;
    minus: number;
    net: number;
    rank: number;
    detailNotes: string;
  }>;
  teacherNote?: string;
  showTeacherNotes?: boolean;
  showSignatures?: boolean;
  signers: { loptruong: string; chidoitruong: string; gvcn: string };
}) {
  const {
    schoolName,
    className,
    academicYear,
    weekNum,
    locationText = 'Bắc Ninh',
    studentScores,
    teacherNote,
    showTeacherNotes = true,
    showSignatures = true,
    signers,
  } = options;

  const today = new Date();

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: schoolName.toUpperCase(), bold: true, size: 19 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${className.toUpperCase()} • SỔ ĐIỂM CHI TIẾT CẢ LỚP`, bold: true, size: 18, color: '1E3A8A' })] }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 19 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', italics: true, size: 18 })] }),
              new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 140 }, children: [new TextRun({ text: `${locationText}, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`, italics: true, size: 16, color: '475569' })] }),
            ],
          }),
        ],
      }),
    ],
  });

  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 250, after: 80 },
    children: [
      new TextRun({ text: `SỔ THEO DÕI ĐIỂM THI ĐUA CHI TIẾT TOÀN LỚP - TUẦN ${weekNum}`, bold: true, size: 26, color: '1E3A8A' }),
    ],
  });

  const subTitleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      new TextRun({ text: `(${className} • Niên khóa ${academicYear} • Tổng sĩ số: ${studentScores.length} học sinh / 4 Tổ)`, italics: true, size: 18, color: '475569' }),
    ],
  });

  const totalPlusClass = studentScores.reduce((s, item) => s + item.plus, 0);
  const totalMinusClass = studentScores.reduce((s, item) => s + item.minus, 0);
  const totalNetClass = studentScores.reduce((s, item) => s + item.net, 0);
  const avgClass = Number((totalNetClass / (studentScores.length || 1)).toFixed(2));

  const summaryParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 250 },
    children: [
      new TextRun({ text: `Thống kê lớp: `, bold: true, size: 17 }),
      new TextRun({ text: `Sĩ số: ${studentScores.length} HS   •   Tổng cộng (+): +${totalPlusClass}đ   •   Tổng trừ (-): -${totalMinusClass}đ   •   ĐTB Lớp: ${avgClass}đ/HS`, size: 17, color: '1E3A8A', bold: true }),
    ],
  });

  const tableRows = [
    new TableRow({
      cantSplit: true,
      children: ['STT', 'HỌ VÀ TÊN HỌC SINH', 'TỔ', 'CHỨC VỤ', 'CỘNG (+)', 'TRỪ (-)', 'ĐIỂM RÒNG', 'CHI TIẾT LÝ DO KHEN THƯỞNG / VI PHẠM'].map((headerText) => (
        new TableCell({
          shading: { fill: '1E3A8A', type: ShadingType.CLEAR, color: 'auto' },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: headerText, bold: true, size: 15, color: 'FFFFFF' })] })],
        })
      )),
    }),
    ...studentScores.map((s) => (
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${s.stt}`, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.name, bold: true, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Tổ ${s.group}`, size: 16 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.role || 'Cán sự/TV', size: 15 })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: s.plus > 0 ? `+${s.plus}` : '-', size: 16, color: '166534' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: s.minus > 0 ? `-${s.minus}` : '-', size: 16, color: '991B1B' })] })] }),
          new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${s.net > 0 ? '+' : ''}${s.net}`, bold: true, size: 16, color: '1E3A8A' })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s.detailNotes || 'Nề nếp tốt, tích cực học tập', italics: !s.detailNotes, size: 15, color: '475569' })] })] }),
        ],
      })
    )),
  ];

  const ledgerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorder,
    rows: tableRows,
  });

  const childrenElements: any[] = [
    headerTable,
    titleParagraph,
    subTitleParagraph,
    summaryParagraph,
    ledgerTable,
  ];

  if (showTeacherNotes && teacherNote) {
    childrenElements.push(
      new Paragraph({
        spacing: { before: 250, after: 150 },
        children: [
          new TextRun({ text: 'Nhận xét & Chỉ đạo của GVCN: ', bold: true, size: 17 }),
          new TextRun({ text: teacherNote, italics: true, size: 17 }),
        ],
      })
    );
  }

  if (showSignatures) {
    const signatureTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'LỚP TRƯỞNG', bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Ký và ghi rõ họ tên)', italics: true, size: 15 })] }),
                new Paragraph({ spacing: { before: 750 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: signers.loptruong, bold: true, size: 18 })] }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CHI ĐỘI TRƯỞNG', bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Xác nhận thi đua)', italics: true, size: 15 })] }),
                new Paragraph({ spacing: { before: 750 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: signers.chidoitruong, bold: true, size: 18 })] }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'GIÁO VIÊN CHỦ NHIỆM', bold: true, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Phê duyệt)', italics: true, size: 15 })] }),
                new Paragraph({ spacing: { before: 750 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: signers.gvcn, bold: true, size: 18 })] }),
              ],
            }),
          ],
        }),
      ],
    });
    childrenElements.push(new Paragraph({ spacing: { before: 300 } }), signatureTable);
  }

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: childrenElements,
      },
    ],
  });

  const filename = `So_Diem_Chi_Tiet_Toan_Lop_Tuan_${weekNum}_${className.replace(/\s+/g, '_')}.docx`;
  await downloadDocxBlob(doc, filename);
}
