import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payroll } from '../entities/payrolls.entity';
import { Payslip } from '../entities/payslips.entity';
import { Employee } from '../entities/employees.entity';
import { Organization } from '../entities/organizations.entity';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { Response } from 'express';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  
  // Define the base storage path for payslips
  private readonly storageBasePath = join(process.cwd(), 'payslips');

  private readonly currencySymbols: { [key: string]: string } = {
    USD: '$',
    EUR: '€',
    INR: 'Rs.',
    GBP: '£',
    AUD: 'A$',
    CAD: 'C$',
    QAR: 'QR',
  };

  // Define color scheme for consistent branding
  private readonly colors = {
    primary: '#003087',
    secondary: '#0057B8',
    accent: '#FFD700',
    light: '#F0F8FF',
    white: '#FFFFFF',
    black: '#000000',
    lightGray: '#F5F5F5',
    mediumGray: '#E0E0E0',
    darkGray: '#707070',
  };

  constructor(
    @InjectRepository(Payslip)
    private payslipRepository: Repository<Payslip>,
  ) {
    this.initializeStorageDirectories();
  }

  private initializeStorageDirectories(): void {
    try {
      if (!existsSync(this.storageBasePath)) {
        mkdirSync(this.storageBasePath, { recursive: true });
        this.logger.log(`Created base storage directory: ${this.storageBasePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to initialize storage directories: ${error.message}`);
      throw error;
    }
  }

  private createPayslipFolderStructure(payrollMonth: Date, orgId: number): string {
    const year = format(payrollMonth, 'yyyy');
    const month = format(payrollMonth, 'MM');
    const folderPath = join(this.storageBasePath, year, month);

    try {
      if (!existsSync(folderPath)) {
        mkdirSync(folderPath, { recursive: true });
        this.logger.log(`Created payslip folder: ${folderPath}`);
      }
      return folderPath;
    } catch (error) {
      this.logger.error(`Failed to create folder structure: ${error.message}`);
      throw error;
    }
  }

  async generatePayslipPdf(payroll: Payroll, employee: Employee, org: Organization): Promise<string> {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50,
      bufferPages: true,
      info: {
        Title: `Payslip - ${employee.firstName} ${employee.lastName}`,
        Author: org.orgName,
        Subject: `Payslip for ${format(payroll.payrollMonth || new Date(), 'MMMM yyyy')}`,
      } 
    });
    
   const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const pdfPromise = new Promise<Uint8Array>((resolve, reject) => {
      doc.on('end', () => {
        try {
          const uint8ArrayChunks = chunks.map(buf => new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
          const finalBuffer = Buffer.concat(uint8ArrayChunks);
          resolve(new Uint8Array(finalBuffer));
        } catch (error) {
          reject(error);
        }
      });
      doc.on('error', (error) => reject(error));
    });


    // Register fonts
    doc.registerFont('Regular', 'Helvetica');
    doc.registerFont('Bold', 'Helvetica-Bold');
    doc.registerFont('Italic', 'Helvetica-Oblique');
    doc.registerFont('BoldItalic', 'Helvetica-BoldOblique');

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - 100;
    
    let currentY = 0;
    
    this.addWatermark(doc, org.orgName || 'Auxai Technologies');

    this.drawHeader(doc, org, payroll);
    currentY = 120;
    
    this.drawEmployeeInfo(doc, employee, payroll, currentY);
    currentY += 70;
    
    this.drawPaymentPeriod(doc, payroll, currentY);
    currentY += 45;
    
    const footerHeight = 50;
    const additionalInfoHeight = 80;
    const summaryHeight = 70;
    const availableHeight = pageHeight - currentY - footerHeight - additionalInfoHeight - summaryHeight - 20;
    
    const earningsDeductionsHeight = this.drawEarningsAndDeductions(doc, payroll, currentY, availableHeight);
    currentY += earningsDeductionsHeight + 10;
    
    this.drawSummary(doc, payroll, currentY);
    currentY += summaryHeight + 10;
    
    this.drawAdditionalInfo(doc, payroll, employee, org, currentY);

    doc.end();

    // Wait for PDF generation to complete
    const pdfBuffer = await pdfPromise;

    // Verify buffer is not empty
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Generated PDF buffer is empty');
    }

    this.logger.log(`PDF buffer generated, size: ${pdfBuffer.length} bytes`);

    // Create folder structure
    const payrollMonth = payroll.payrollMonth || new Date();
    const folderPath = this.createPayslipFolderStructure(payrollMonth, org.orgId);

    // Generate filename
    const fileName = `payslip_${employee.employeeId || employee.id}_${format(payrollMonth, 'yyyy-MM')}.pdf`;
    const filePath = join(folderPath, fileName);

    try {
      // CRITICAL FIX: Write the buffer directly, don't convert to string
      writeFileSync(filePath, pdfBuffer);
      this.logger.log(`Payslip saved successfully: ${filePath} (${pdfBuffer.length} bytes)`);

      // Verify file was written correctly
      if (existsSync(filePath)) {
        const fileStats = require('fs').statSync(filePath);
        this.logger.log(`File verified: ${fileStats.size} bytes on disk`);
      }

      // Return relative path for database storage
      const relativePath = join('payslips', format(payrollMonth, 'yyyy'), format(payrollMonth, 'MM'), fileName);
      return relativePath.replace(/\\/g, '/');
    } catch (error) {
      this.logger.error(`Failed to save payslip: ${error.message}`, error.stack);
      throw error;
    }
  }

  private getAbsolutePayslipPath(relativePath: string): string {
    return join(process.cwd(), relativePath);
  }

  async checkPayslipExists(relativePath: string): Promise<boolean> {
    try {
      const absolutePath = this.getAbsolutePayslipPath(relativePath);
      return existsSync(absolutePath);
    } catch (error) {
      this.logger.error(`Error checking payslip existence: ${error.message}`);
      return false;
    }
  }

  async getPayslipBuffer(payslipId: number): Promise<{ buffer: Buffer; fileName: string }> {
    const payslip = await this.payslipRepository.findOne({ 
      where: { id: payslipId },
      relations: ['employee', 'payroll'] 
    });
    
    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }

    const absolutePath = this.getAbsolutePayslipPath(payslip.pdfUrl);
    
    if (!existsSync(absolutePath)) {
      this.logger.error(`Payslip file not found at: ${absolutePath}`);
      throw new NotFoundException('Payslip file not found on server');
    }

    try {
      const buffer = readFileSync(absolutePath);
      
      if (buffer.length === 0) {
        throw new Error('Payslip file is empty');
      }
      
      const fileName = `payslip_${payslip.employee.employeeId}_${format(payslip.payroll.payrollMonth, 'yyyy-MM')}.pdf`;
      
      this.logger.log(`Read payslip file: ${absolutePath} (${buffer.length} bytes)`);
      return { buffer, fileName };
    } catch (error) {
      this.logger.error(`Error reading payslip file: ${error.message}`);
      throw new Error('Failed to read payslip file');
    }
  }

  async servePayslipFile(payslipId: number, response: Response): Promise<void> {
    try {
      const { buffer, fileName } = await this.getPayslipBuffer(payslipId);
      
      response.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      });
      
      response.send(buffer);
    } catch (error) {
      this.logger.error(`Error serving payslip: ${error.message}`);
      throw error;
    }
  }

  async getPayslipForViewing(payslipId: number, response: Response): Promise<void> {
    try {
      const { buffer, fileName } = await this.getPayslipBuffer(payslipId);
      
      response.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      });
      
      response.send(buffer);
    } catch (error) {
      this.logger.error(`Error serving payslip for viewing: ${error.message}`);
      throw error;
    }
  }

  // Keep all your existing private methods (addWatermark, drawHeader, etc.)
  private addWatermark(doc: any, orgName: string): void {
    doc.save();
    doc.rotate(45, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.fontSize(60);
    doc.fillColor(this.colors.mediumGray + '15');
    doc.font('Bold');
    doc.text(orgName, 0, 0, {
      align: 'center',
      width: doc.page.width * 1.5,
    });
    doc.restore();
  }

  private drawHeader(doc: any, org: Organization, payroll: Payroll): void {
    doc.rect(0, 0, doc.page.width, 120).fill(this.colors.white);
    
    const logoPath = join(__dirname, '../../src/public/Auxaitech-01.jpg');
    if (existsSync(logoPath)) {
      try {
        doc.image(logoPath, 50, 20, { width: 100 });
      } catch (error) {
        this.logger.warn(`Failed to include company logo: ${error.message}`);
      }
    }
    
    doc.font('Bold')
       .fontSize(20)
       .fillColor(this.colors.black)
       .text(org.orgName || 'Auxai Technologies PVT LTD', 170, 30)
       .font('Regular')
       .fontSize(10)
       .text(org.location || 'Qatar', 170, 55)
       .text(org.location || 'Qatar', 170, 70)
       .text(`Email: hr@auxaitech.com | Phone: +974 123 4567`, 170, 85);
    
    doc.font('Bold')
       .fontSize(18)
       .fillColor(this.colors.black)
       .text('PAYSLIP', doc.page.width - 150, 30, { align: 'right' })
       .font('Regular')
       .fontSize(10)
       .text(`Reference: PSL-${payroll.id || '285'}`, doc.page.width - 150, 55, { align: 'right' })
       .text(`Date: ${format(payroll.payrollMonth || new Date(), 'dd MMM yyyy')}`, doc.page.width - 150, 70, { align: 'right' });
  }

  private drawEmployeeInfo(doc: any, employee: Employee, payroll: Payroll, yPosition: number): void {
    const BankInfo = employee.bankAccounts?.[0];
    
    doc.rect(50, yPosition, doc.page.width - 100, 60)
       .fillAndStroke(this.colors.light, this.colors.mediumGray);
    
    doc.fillColor(this.colors.black)
       .font('Bold')
       .fontSize(11)
       .text('Employee Information', 60, yPosition + 10)
       .font('Regular')
       .fontSize(9)
       .text(`Name: ${employee.firstName} ${employee.lastName || 'Mandya'}`, 60, yPosition + 25)
       .text(`Employee ID: ${employee.employeeId || 'AUX0003'}`, 60, yPosition + 37)
       .text(`Department: ${employee.department || 'IT'}`, 60, yPosition + 49);
    
    doc.font('Bold')
       .fontSize(11)
       .text('Payment Details', doc.page.width / 2, yPosition + 10)
       .font('Regular')
       .fontSize(9)
       .text(`Bank: ${BankInfo?.bankName || 'AXIS BANK'}`, doc.page.width / 2, yPosition + 25)
       .text(`Account: ${this.formatAccountNumber(BankInfo?.accountNo || '8888888888')}`, doc.page.width / 2, yPosition + 37);
  }

  private formatAccountNumber(accountNo: string): string {
    if (accountNo.length <= 4) return accountNo;
    return 'XXXX-XXXX-' + accountNo.slice(-4);
  }

  private drawPaymentPeriod(doc: any, payroll: Payroll, yPosition: number): void {
    doc.rect(50, yPosition, doc.page.width - 100, 35)
       .fillAndStroke(this.colors.secondary, this.colors.mediumGray);
    
    const payMonth = new Date(payroll.payrollMonth) || new Date();
    const startDate = new Date(payMonth.getFullYear(), payMonth.getMonth(), 1);
    
    doc.fillColor(this.colors.white)
       .font('Bold')
       .fontSize(12)
       .text(`Payslip for the Month of ${format(startDate, 'MMMM yyyy')}`, 60, yPosition + 10, { align: 'center' });
  }

  private drawEarningsAndDeductions(doc: any, payroll: Payroll, yPosition: number, maxHeight: number): number {
    const rowHeight = 25;
    
    const earnings = [
      { description: 'Basic Salary', amount: Number(payroll.basicSalary) },
      { description: 'HRA Allowance', amount: Number(payroll.allowances) },
      { description: 'Special Allowance', amount: Number(payroll.specialAllowances) },
      { description: 'Other Allowance', amount: Number(payroll.otherAllowances) },
    ].filter(e => e.amount > 0);
    
    const deductions = [
      { description: 'Income Tax', amount: Number(payroll.taxDeductions) },
      { description: 'Other Deductions', amount: Number(payroll.deductions) },
    ].filter(d => d.amount > 0);
    
    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    
    const headerHeight = 30;
    const columnHeaderHeight = 25;
    const totalRowHeight = 30;
    
    const maxRows = Math.floor((maxHeight - headerHeight - columnHeaderHeight - totalRowHeight) / rowHeight);
    const earningsRows = Math.min(earnings.length, maxRows);
    const deductionsRows = Math.min(deductions.length, maxRows);
    
    // Draw earnings header
    doc.rect(50, yPosition, (doc.page.width - 100) / 2 - 5, headerHeight)
       .fillAndStroke(this.colors.primary, this.colors.mediumGray);
    
    doc.fillColor(this.colors.white)
       .font('Bold')
       .fontSize(12)
       .text('EARNINGS', 60, yPosition + 10, { align: 'center', width: (doc.page.width - 100) / 2 - 25 });
    
    // Draw deductions header
    doc.rect(50 + (doc.page.width - 100) / 2 + 5, yPosition, (doc.page.width - 100) / 2 - 5, headerHeight)
       .fillAndStroke(this.colors.primary, this.colors.mediumGray);
    
    doc.fillColor(this.colors.white)
       .font('Bold')
       .fontSize(12)
       .text('DEDUCTIONS', 50 + (doc.page.width - 100) / 2 + 15, yPosition + 10, 
         { align: 'center', width: (doc.page.width - 100) / 2 - 25 });
    
    yPosition += headerHeight;
    
    // Column headers
    const columnWidth = (doc.page.width - 100) / 2 - 5;
    const earningsAmountX = 50 + columnWidth - 90;
    
    doc.rect(50, yPosition, columnWidth, columnHeaderHeight)
       .fillAndStroke(this.colors.lightGray, this.colors.mediumGray);
    
    doc.fillColor(this.colors.black)
       .font('Bold')
       .fontSize(10)
       .text('Description', 60, yPosition + 8)
       .text('Amount', earningsAmountX, yPosition + 8, { align: 'right', width: 80 });
    
    const deductionsStartX = 50 + (doc.page.width - 100) / 2 + 5;
    const deductionsAmountX = deductionsStartX + columnWidth - 90;
    
    doc.rect(deductionsStartX, yPosition, columnWidth, columnHeaderHeight)
       .fillAndStroke(this.colors.lightGray, this.colors.mediumGray);
    
    doc.fillColor(this.colors.black)
       .font('Bold')
       .fontSize(10)
       .text('Description', deductionsStartX + 10, yPosition + 8)
       .text('Amount', deductionsAmountX, yPosition + 8, { align: 'right', width: 80 });
    
    yPosition += columnHeaderHeight;
    let earningsY = yPosition;
    
    // Draw earnings rows
    for (let i = 0; i < earningsRows; i++) {
      const earning = earnings[i];
      
      doc.rect(50, earningsY, columnWidth, rowHeight)
         .fillAndStroke(i % 2 === 0 ? this.colors.white : this.colors.lightGray, this.colors.mediumGray);
      
      doc.fillColor(this.colors.black)
         .font('Regular')
         .fontSize(9)
         .text(earning.description, 60, earningsY + 8);
      
      const formattedAmount = `${this.currencySymbols[payroll.currency] || 'QR'} ${earning.amount.toFixed(2)}`;
      doc.text(formattedAmount, earningsAmountX, earningsY + 8, { align: 'right', width: 80 });
      
      earningsY += rowHeight;
    }
    
    // Draw deductions rows
    let deductionsY = yPosition;
    
    for (let i = 0; i < deductionsRows; i++) {
      const deduction = deductions[i];
      
      doc.rect(deductionsStartX, deductionsY, columnWidth, rowHeight)
         .fillAndStroke(i % 2 === 0 ? this.colors.white : this.colors.lightGray, this.colors.mediumGray);
      
      doc.fillColor(this.colors.black)
         .font('Regular')
         .fontSize(9)
         .text(deduction.description, deductionsStartX + 10, deductionsY + 8);
      
      const formattedAmount = `${this.currencySymbols[payroll.currency] || 'QR'} ${deduction.amount.toFixed(2)}`;
      doc.text(formattedAmount, deductionsAmountX, deductionsY + 8, { align: 'right', width: 80 });
      
      deductionsY += rowHeight;
    }
    
    // Total rows
    const totalRowPosition = yPosition + Math.max(earningsRows, deductionsRows) * rowHeight;
    
    doc.rect(50, totalRowPosition, columnWidth, totalRowHeight)
       .fillAndStroke(this.colors.secondary, this.colors.mediumGray);
    
    doc.fillColor(this.colors.white)
       .font('Bold')
       .fontSize(10)
       .text('Total Earnings', 60, totalRowPosition + 10);
    
    const formattedTotalEarnings = `${this.currencySymbols[payroll.currency] || 'QR'} ${totalEarnings.toFixed(2)}`;
    doc.text(formattedTotalEarnings, earningsAmountX, totalRowPosition + 10, { align: 'right', width: 80 });
    
    doc.rect(deductionsStartX, totalRowPosition, columnWidth, totalRowHeight)
       .fillAndStroke(this.colors.secondary, this.colors.mediumGray);
    
    doc.fillColor(this.colors.white)
       .font('Bold')
       .fontSize(10)
       .text('Total Deductions', deductionsStartX + 10, totalRowPosition + 10);
    
    const formattedTotalDeductions = `${this.currencySymbols[payroll.currency] || 'QR'} ${totalDeductions.toFixed(2)}`;
    doc.text(formattedTotalDeductions, deductionsAmountX, totalRowPosition + 10, { align: 'right', width: 80 });
    
    return headerHeight + columnHeaderHeight + (Math.max(earningsRows, deductionsRows) * rowHeight) + totalRowHeight;
  }

  private drawSummary(doc: any, payroll: Payroll, yPosition: number): void {
    const netPay = Number(payroll.netSalary);
    
    doc.rect(50, yPosition, doc.page.width - 100, 60)
       .fillAndStroke(this.colors.primary, this.colors.mediumGray);
    
    doc.fillColor(this.colors.white)
       .font('Bold')
       .fontSize(14)
       .text('NET PAY', 60, yPosition + 15);
    
    const formattedNetPay = `${this.currencySymbols[payroll.currency] || 'QR'} ${netPay.toFixed(2)}`;
    const amountX = doc.page.width - 170;
    
    doc.font('Bold')
       .fontSize(16)
       .text(formattedNetPay, amountX, yPosition + 15, { align: 'right', width: 100 });
    
    doc.strokeColor(this.colors.white)
       .lineWidth(0.5)
       .moveTo(60, yPosition + 35)
       .lineTo(doc.page.width - 60, yPosition + 35)
       .stroke();
    
    doc.font('Italic')
       .fontSize(9)
       .text(`Amount in words: ${this.numberToWords(netPay, payroll)}`, 60, yPosition + 42, 
         { width: doc.page.width - 120, align: 'center' });
  }

  private drawAdditionalInfo(doc: any, payroll: Payroll, employee: Employee, org: Organization, yPosition: number): void {
    doc.rect(50, yPosition, doc.page.width - 100, 80)
       .fillAndStroke(this.colors.light, this.colors.mediumGray);
    
    doc.fillColor(this.colors.black)
       .font('Bold')
       .fontSize(9)
       .text('Notes & Additional Information', 60, yPosition + 8)
       .font('Regular')
       .fontSize(8)
       .text([
         '• This is a computer-generated payslip and does not require a signature.',
         '• Please report any discrepancies to the HR department within 5 working days.',
         `• For any queries, please contact: hr@auxaitech.com or +974 123 4567 ext. 8900`,
         '• This payslip is confidential and for your personal use only.',
       ].join('\n'), 60, yPosition + 20);
  }

  private numberToWords(amount: number, payroll: Payroll): string {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertHundreds = (num: number) => {
      if (num === 0) return '';
      if (num < 20) return units[num] + ' ';
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + units[num % 10] : '') + ' ';
      return units[Math.floor(num / 100)] + ' Hundred ' + convertHundreds(num % 100);
    };

    const convert = (num: number) => {
      if (num === 0) return 'Zero';
      let words = '';
      
      if (Math.floor(num / 1000000) > 0) {
        words += convertHundreds(Math.floor(num / 1000000)) + 'Million ';
        num %= 1000000;
      }
      if (Math.floor(num / 1000) > 0) {
        words += convertHundreds(Math.floor(num / 1000)) + 'Thousand ';
        num %= 1000;
      }
      if (Math.floor(num / 100) > 0) {
        words += convertHundreds(Math.floor(num / 100)) + 'Hundred ';
        num %= 100;
      }
      if (num > 0) {
        words += convertHundreds(num);
      }
      return words.trim() + ' Only';
    };

    const currencyNames: { [key: string]: string } = {
      USD: 'Dollars', EUR: 'Euros', INR: 'Rupees', GBP: 'Pounds',
      AUD: 'AUD', CAD: 'CAD', QAR: 'QAR',
    };

    const currencyName = currencyNames[payroll.currency] || 'QAR';
    return `${convert(Math.floor(amount))} ${currencyName}`;
  }
}