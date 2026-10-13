/**
 * Universal Student List Importer & Parser (Buildicy Engine)
 * Supports: Excel (.xlsx, .xls), CSV (.csv), TSV (.tsv), Plain Text (.txt, .md), JSON (.json), Clipboard text
 * Lazy-loads SheetJS on-demand only when Excel files are provided for sub-50ms instant initial page load.
 */

export class StudentImporter {
  constructor() {
    this.commonHeaderTerms = [
      'name', 'student', 'candidate', 'fullname', 'full name', 
      'student name', 'candidate name', 'participant', 'member', 'person', 'learner'
    ];
    this.sheetJSLoadingPromise = null;
  }

  /**
   * Parse a File object into an array of clean student names
   * @param {File} file 
   * @returns {Promise<string[]>}
   */
  async parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      return this.parseExcelFile(file);
    } else if (ext === 'csv' || ext === 'tsv') {
      const text = await file.text();
      return this.parseDelimitedText(text);
    } else if (ext === 'json') {
      const text = await file.text();
      return this.parseJSON(text);
    } else {
      // Default to text parser (.txt, .md, unknown)
      const text = await file.text();
      return this.parsePlainText(text);
    }
  }

  /**
   * Parse raw text string pasted from clipboard or textarea
   * @param {string} text 
   * @returns {string[]}
   */
  parseRawInput(text) {
    if (!text || !text.trim()) return [];
    text = text.trim();

    // Check if it might be JSON
    if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
      try {
        const jsonResult = this.parseJSON(text);
        if (jsonResult.length > 0) return jsonResult;
      } catch (e) {
        // Fall back to text parsing
      }
    }

    // Check if it's CSV-like (contains commas or tabs with multiple rows)
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length > 1 && (lines[0].includes(',') || lines[0].includes('\t') || lines[0].includes(';'))) {
      const csvResult = this.parseDelimitedText(text);
      if (csvResult.length > 0) return csvResult;
    }

    return this.parsePlainText(text);
  }

  /**
   * Parse plain text line by line or delimiter-based
   * Strips bullets, numbering (1., 1), [1], etc.), extra whitespace
   */
  parsePlainText(text) {
    if (!text) return [];
    
    let rawLines = text.split(/\r?\n/);
    
    if (rawLines.length === 1 && (text.includes(',') || text.includes(';'))) {
      rawLines = text.split(/[,;]/);
    }

    const cleanNames = [];

    for (let line of rawLines) {
      let cleaned = this.cleanLine(line);
      if (cleaned && cleaned.length >= 1) {
        if (cleanNames.length === 0 && this.isHeaderLine(cleaned)) {
          continue;
        }
        cleanNames.push(cleaned);
      }
    }

    return cleanNames;
  }

  cleanLine(line) {
    if (!line) return '';
    let str = line.trim();

    // Remove markdown list bullets: *, -, +, •, ◦, ▪
    str = str.replace(/^[\*\-\+•◦▪]\s*/, '');

    // Remove numbering patterns like "1. John Doe", "1) John", "[1] John", "1 - John"
    str = str.replace(/^(?:#|\b)?\d+[\.\)\:\-\]\s]+\s*/i, '');
    str = str.replace(/^\[\d+\]\s*/, '');

    // Remove enclosing quotes or brackets
    str = str.replace(/^["'`]+|["'`]+$/g, '');

    // Collapse multiple internal spaces
    str = str.replace(/\s+/g, ' ').trim();

    return str;
  }

  parseDelimitedText(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];

    // Detect delimiter
    const firstLine = lines[0];
    const counts = {
      ',': (firstLine.match(/,/g) || []).length,
      '\t': (firstLine.match(/\t/g) || []).length,
      ';': (firstLine.match(/;/g) || []).length,
      '|': (firstLine.match(/\|/g) || []).length,
    };

    let delimiter = ',';
    let maxCount = 0;
    for (const [delim, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        delimiter = delim;
      }
    }

    const rows = lines.map(line => this.splitCSVLine(line, delimiter));
    if (rows.length === 0) return [];

    const headerRow = rows[0];
    let nameColIndex = 0;
    let hasHeader = false;

    for (let c = 0; c < headerRow.length; c++) {
      const col = headerRow[c].toLowerCase().trim();
      if (this.commonHeaderTerms.some(term => col.includes(term))) {
        nameColIndex = c;
        hasHeader = true;
        break;
      }
    }

    if (!hasHeader && rows.length > 1) {
      if (this.isHeaderRowLikely(headerRow, rows[1])) {
        hasHeader = true;
        nameColIndex = this.findBestNameColumn(rows.slice(1));
      } else {
        nameColIndex = this.findBestNameColumn(rows);
      }
    }

    const startIndex = hasHeader ? 1 : 0;
    const names = [];

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (row && row[nameColIndex] !== undefined) {
        const val = this.cleanLine(row[nameColIndex]);
        if (val) {
          names.push(val);
        }
      }
    }

    return names;
  }

  splitCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  findBestNameColumn(sampleRows) {
    if (!sampleRows || sampleRows.length === 0) return 0;
    const colCount = sampleRows[0].length;
    let bestCol = 0;
    let bestScore = -1;

    for (let col = 0; col < colCount; col++) {
      let score = 0;
      let nonNumeric = 0;
      let totalChecked = 0;

      for (let r = 0; r < Math.min(sampleRows.length, 20); r++) {
        const val = sampleRows[r][col];
        if (val) {
          totalChecked++;
          if (!/^\d+$/.test(val.trim())) {
            nonNumeric++;
          }
          if (val.trim().length >= 3 && val.trim().length <= 40) {
            score += 2;
          }
        }
      }

      if (totalChecked > 0 && (nonNumeric / totalChecked) > 0.6) {
        score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }

    return bestCol;
  }

  isHeaderRowLikely(firstRow, secondRow) {
    return firstRow.some(val => {
      const v = val.toLowerCase().trim();
      return this.commonHeaderTerms.some(t => v.includes(t)) || v === 'id' || v === 'roll' || v === 'sr no';
    });
  }

  isHeaderLine(line) {
    const l = line.toLowerCase();
    return this.commonHeaderTerms.includes(l) || l === 'students' || l === 'student list' || l === 'participants';
  }

  async parseExcelFile(file) {
    // Lazy-load SheetJS only when needed
    await this.ensureSheetJS();

    const data = await file.arrayBuffer();
    const workbook = window.XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (!rows || rows.length === 0) return [];

    const headerRow = rows[0] || [];
    let nameColIndex = 0;
    let hasHeader = false;

    for (let c = 0; c < headerRow.length; c++) {
      const colStr = String(headerRow[c] || '').toLowerCase().trim();
      if (this.commonHeaderTerms.some(term => colStr.includes(term))) {
        nameColIndex = c;
        hasHeader = true;
        break;
      }
    }

    if (!hasHeader && rows.length > 1) {
      nameColIndex = this.findBestNameColumn(rows.slice(1).map(r => r.map(c => String(c || ''))));
    }

    const startIndex = hasHeader ? 1 : 0;
    const names = [];

    for (let r = startIndex; r < rows.length; r++) {
      const row = rows[r];
      if (row && row[nameColIndex] !== undefined) {
        const val = this.cleanLine(String(row[nameColIndex]));
        if (val) {
          names.push(val);
        }
      }
    }

    return names;
  }

  parseJSON(text) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      if (data.length === 0) return [];
      if (typeof data[0] === 'string') {
        return data.map(item => this.cleanLine(item)).filter(Boolean);
      }
      if (typeof data[0] === 'object' && data[0] !== null) {
        const keys = Object.keys(data[0]);
        let chosenKey = keys[0];
        for (const k of keys) {
          const lk = k.toLowerCase();
          if (this.commonHeaderTerms.some(t => lk.includes(t))) {
            chosenKey = k;
            break;
          }
        }
        return data.map(item => this.cleanLine(String(item[chosenKey] || ''))).filter(Boolean);
      }
    } else if (typeof data === 'object' && data !== null) {
      for (const key of ['students', 'candidates', 'names', 'list', 'participants', 'items']) {
        if (Array.isArray(data[key])) {
          return this.parseJSON(JSON.stringify(data[key]));
        }
      }
    }
    return [];
  }

  ensureSheetJS() {
    if (window.XLSX) return Promise.resolve();
    if (this.sheetJSLoadingPromise) return this.sheetJSLoadingPromise;

    this.sheetJSLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        this.sheetJSLoadingPromise = null;
        reject(new Error('Unable to load Excel parser. Please check internet connection.'));
      };
      document.head.appendChild(script);
    });

    return this.sheetJSLoadingPromise;
  }

  /**
   * High-speed test student generator for 25, 100, 500, or 1000 candidates
   */
  static generateRealisticStudents(count = 500) {
    const firstNames = [
      'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
      'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Kabir', 'Dhruv', 'Darsh', 'Samarth', 'Aryan',
      'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Kiara', 'Ira', 'Myra', 'Anika', 'Prisha', 'Riya',
      'Aanya', 'Navya', 'Pari', 'Avani', 'Sara', 'Aditi', 'Shanaya', 'Kavya', 'Meera', 'Khushi',
      'Liam', 'Noah', 'Oliver', 'James', 'Elijah', 'William', 'Henry', 'Lucas', 'Benjamin', 'Theodore',
      'Emma', 'Olivia', 'Charlotte', 'Amelia', 'Sophia', 'Isabella', 'Ava', 'Mia', 'Evelyn', 'Luna',
      'Alexander', 'Sebastian', 'Jack', 'Daniel', 'Mateo', 'David', 'Joseph', 'Carter', 'Owen', 'Wyatt',
      'Harper', 'Camila', 'Gianna', 'Abigail', 'Ella', 'Emily', 'Avery', 'Sofia', 'Chloe', 'Scarlett',
      'Chen', 'Wei', 'Ming', 'Jin', 'Hao', 'Yuki', 'Kenji', 'Hiroshi', 'Sora', 'Ren'
    ];

    const lastNames = [
      'Sharma', 'Verma', 'Patel', 'Reddy', 'Kumar', 'Singh', 'Gupta', 'Iyer', 'Nair', 'Chopra',
      'Deshmukh', 'Kulkarni', 'Joshi', 'Mehta', 'Shah', 'Bhat', 'Rao', 'Das', 'Roy', 'Mukherjee',
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
      'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
      'Tanaka', 'Sato', 'Suzuki', 'Takahashi', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato'
    ];

    const tracks = ['FullStack', 'AI/ML', 'Cloud', 'CyberSec', 'DevOps', 'UI/UX', 'Product', 'DataSci'];

    const students = new Array(count);
    const fnLen = firstNames.length;
    const lnLen = lastNames.length;
    const trLen = tracks.length;

    for (let i = 0; i < count; i++) {
      const fn = firstNames[i % fnLen];
      const ln = lastNames[(i * 3 + 7) % lnLen];
      const track = tracks[i % trLen];
      const idNum = 1000 + i + 1;
      students[i] = `${fn} ${ln} [${track}-${idNum}]`;
    }

    return students;
  }
}
