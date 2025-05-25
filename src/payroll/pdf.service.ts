import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payroll } from '../entities/payrolls.entity';
import { Payslip } from '../entities/payslips.entity';
import { Employee } from '../entities/employees.entity';
import { Organization } from '../entities/organizations.entity';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  PutBucketLifecycleConfigurationCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { join } from 'path';
import { existsSync } from 'fs';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

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
    primary: '#003087',       // Dark blue for header and important elements
    secondary: '#0057B8',     // Medium blue for secondary elements
    accent: '#FFD700',        // Gold accent for highlights
    light: '#F0F8FF',         // Light blue background
    white: '#FFFFFF',         // White for text on dark backgrounds
    black: '#000000',         // Black for text on light backgrounds
    lightGray: '#F5F5F5',     // Light gray for alternating rows
    mediumGray: '#E0E0E0',    // Medium gray for borders
    darkGray: '#707070',      // Dark gray for secondary text
  };

  constructor(
    @InjectRepository(Payslip)
    private payslipRepository: Repository<Payslip>,
  ) {}

  async generatePayslipPdf(payroll: Payroll, employee: Employee, org: Organization): Promise<string> {
    // Create a new instance of PDFDocument
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50,
      bufferPages: true, // Enable buffer pages to control page count
      info: {
        Title: `Payslip - ${employee.firstName} ${employee.lastName}`,
        Author: org.orgName,
        Subject: `Payslip for ${format(payroll.payrollMonth || new Date(), 'MMMM yyyy')}`,
      } 
    });
    
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(new Uint8Array(chunk)));
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        try {
          const finalBuffer = Buffer.concat(chunks as readonly Uint8Array[]);
          resolve(finalBuffer);
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

    // Document dimensions
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - 100; // Accounting for margins on both sides
    
    // Track the current Y position to prevent overflow
    let currentY = 0;
    
    // Add subtle watermark if needed
    this.addWatermark(doc, org.orgName || 'Auxai Technologies');

    // Header section with logo and company info - Height: ~120px
    this.drawHeader(doc, org, payroll);
    currentY = 120;
    
    // Employee and payment information - Height: ~60px
    this.drawEmployeeInfo(doc, employee, payroll, currentY);
    currentY += 70; // Add 10px padding
    
    // Payment period and details - Height: ~35px
    this.drawPaymentPeriod(doc, payroll, currentY);
    currentY += 45; // Add 10px padding
    
    // Calculate remaining space for earnings/deductions
    const footerHeight = 50;
    const additionalInfoHeight = 80;
    const summaryHeight = 70;
    const availableHeight = pageHeight - currentY - footerHeight - additionalInfoHeight - summaryHeight - 20; // 20px buffer
    
    // Earnings and deductions tables - Dynamic height
    const earningsDeductionsHeight = this.drawEarningsAndDeductions(doc, payroll, currentY, availableHeight);
    currentY += earningsDeductionsHeight + 10; // Add padding
    
    // Summary section - Height: ~60px
    this.drawSummary(doc, payroll, currentY);
    currentY += summaryHeight + 10; // Add padding
    
    // Additional information and footer
    this.drawAdditionalInfo(doc, payroll, employee, org, currentY);

    // Ensure there's only one page (remove any additional pages)
    if (doc.bufferedPageRange().count > 1) {
      // Get only the first page
      const pages = doc.bufferedPageRange();
      for (let i = 1; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.text(''); // Clear the page
      }
      doc.switchToPage(0); // Switch back to first page
    }

    doc.end();

    const pdfBuffer = await pdfPromise;
    const key = `payslips/payslip_${employee.employeeId || employee.id}_${format(payroll.payrollMonth || new Date(), 'yyyy-MM')}.pdf`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ServerSideEncryption: 'AES256',
      }),
    );

    return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }

  private addWatermark(doc: any, orgName: string): void {
    // Add a subtle watermark diagonally across the page
    doc.save();
    doc.rotate(45, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.fontSize(60);
    doc.fillColor(this.colors.mediumGray + '15'); // Very light opacity (15%)
    doc.font('Bold');
    doc.text(orgName, 0, 0, {
      align: 'center',
      width: doc.page.width * 1.5,
    });
    doc.restore();
  }

  private drawHeader(doc: any, org: Organization, payroll: Payroll): void {
    // Create a header strip
    doc.rect(0, 0, doc.page.width, 120)
       .fill(this.colors.white);
    
    // Add company logo if available
    const logoPath = join(__dirname, '../../src/public/Auxaitech-01.jpg');
    if (existsSync(logoPath)) {
      try {
        doc.image(logoPath, 50, 20, { width: 100 });
      } catch (error) {
        this.logger.warn(`Failed to include company logo: ${error.message}`);
      }
    }
    
    // Add company information
    doc.font('Bold')
       .fontSize(20)
       .fillColor(this.colors.black)
       .text(org.orgName || 'Auxai Technologies PVT LTD', 170, 30)
       .font('Regular')
       .fontSize(10)
       .text(org.location || 'Qatar', 170, 55)
       .text(org.location || 'Qatar', 170, 70)
       .text(`Email: hr@auxaitech.com | Phone: +974 123 4567`, 170, 85);
    
    // Add payslip title and reference
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
    // Create a light blue background box for employee info
    const BankInfo=employee.bankAccounts[0];
    
    doc.rect(50, yPosition, doc.page.width - 100, 60)
       .fillAndStroke(this.colors.light, this.colors.mediumGray);
    
    // Left column: Employee details
    doc.fillColor(this.colors.black)
       .font('Bold')
       .fontSize(11)
       .text('Employee Information', 60, yPosition + 10)
       .font('Regular')
       .fontSize(9)
       .text(`Name: ${employee.firstName} ${employee.lastName || 'Mandya'}`, 60, yPosition + 25)
       .text(`Employee ID: ${employee.employeeId || 'AUX0003'}`, 60, yPosition + 37)
       .text(`Department: ${employee.department || 'IT'}`, 60, yPosition + 49);
    
    // Right column: Payment details
    doc.font('Bold')
       .fontSize(11)
       .text('Payment Details', doc.page.width / 2, yPosition + 10)
       .font('Regular')
       .fontSize(9)
       .text(`Bank: ${BankInfo?.bankName || 'AXIS BANK'}`, doc.page.width / 2, yPosition + 25)
       .text(`Account: ${this.formatAccountNumber(BankInfo?.accountNo || '8888888888')}`, doc.page.width / 2, yPosition + 37);
  }

  private formatAccountNumber(accountNo: string): string {
    // Format account number to show only last 4 digits for security
    if (accountNo.length <= 4) return accountNo;
    return 'XXXX-XXXX-' + accountNo.slice(-4);
  }

  private drawPaymentPeriod(doc: any, payroll: Payroll, yPosition: number): void {
    // Create background for payment period section
    doc.rect(50, yPosition, doc.page.width - 100, 35)
       .fillAndStroke(this.colors.secondary, this.colors.mediumGray);
    
    // Payment period information
    const payMonth =new Date(payroll.payrollMonth) || new Date();
    const startDate = new Date(payMonth.getFullYear(), payMonth.getMonth(), 1);
    const endDate = new Date(payMonth.getFullYear(), payMonth.getMonth() + 1, 0);
    
    doc.fillColor(this.colors.white)
       .font('Bold')
       .fontSize(12)
       .text(`Payslip for the Month of ${format(startDate, 'MMMM yyyy')}`, 60, yPosition + 10,{ align: 'center' })
      
  }

  private drawEarningsAndDeductions(doc: any, payroll: Payroll, yPosition: number, maxHeight: number): number {
    // Ensure this section doesn't exceed available space
    const rowHeight = 25;
    
    // Prepare data for earnings table
    const earnings = [
      { description: 'Basic Salary', amount: Number(payroll.basicSalary)},
      { description: 'HRA Allowance', amount: Number(payroll.allowances ) },
      { description: 'Special Allowance', amount: Number(payroll.specialAllowances ) },
      { description: 'Other Allowance', amount: Number(payroll.otherAllowances ) },

    ].filter(e => e.amount > 0); // Only include non-zero amounts
    
    // Prepare data for deductions table
    const deductions = [
      { description: 'Income Tax', amount: Number(payroll.taxDeductions)},
      { description: 'Other Deductions', amount: Number(payroll.deductions) },
    ].filter(d => d.amount > 0); // Only include non-zero amounts
    
    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    
    // Calculate required height
    const headerHeight = 30;
    const columnHeaderHeight = 25;
    const totalRowHeight = 30;
    
    const maxRows = Math.floor((maxHeight - headerHeight - columnHeaderHeight - totalRowHeight) / rowHeight);
    const earningsRows = Math.min(earnings.length, maxRows);
    const deductionsRows = Math.min(deductions.length, maxRows);
    
    // Header for earnings section
    doc.rect(50, yPosition, (doc.page.width - 100) / 2 - 5, headerHeight)
       .fillAndStroke(this.colors.primary, this.colors.mediumGray);
    
    doc.fillColor(this.colors.white)
       .font('Bold')
       .fontSize(12)
       .text('EARNINGS', 60, yPosition + 10, { align: 'center', width: (doc.page.width - 100) / 2 - 25 });
    
    // Header for deductions section
    doc.rect(50 + (doc.page.width - 100) / 2 + 5, yPosition, (doc.page.width - 100) / 2 - 5, headerHeight)
       .fillAndStroke(this.colors.primary, this.colors.mediumGray);
    
    doc.fillColor(this.colors.white)
       .font('Bold')
       .fontSize(12)
       .text('DEDUCTIONS', 50 + (doc.page.width - 100) / 2 + 15, yPosition + 10, 
         { align: 'center', width: (doc.page.width - 100) / 2 - 25 });
    
    // Table column headers for earnings
    yPosition += headerHeight;
    doc.rect(50, yPosition, (doc.page.width - 100) / 2 - 5, columnHeaderHeight)
       .fillAndStroke(this.colors.lightGray, this.colors.mediumGray);
    
    doc.fillColor(this.colors.black)
       .font('Bold')
       .fontSize(10)
       .text('Description', 60, yPosition + 8);
    
    // Consistent positioning for both amount columns
    const columnWidth = (doc.page.width - 100) / 2 - 5;
    const earningsAmountX = 50 + columnWidth - 90;
    
    doc.text('Amount', earningsAmountX, yPosition + 8, { align: 'right', width: 80 });
    
    // Table column headers for deductions
    doc.rect(50 + (doc.page.width - 100) / 2 + 5, yPosition, (doc.page.width - 100) / 2 - 5, columnHeaderHeight)
       .fillAndStroke(this.colors.lightGray, this.colors.mediumGray);
    
    doc.fillColor(this.colors.black)
       .font('Bold')
       .fontSize(10)
       .text('Description', 50 + (doc.page.width - 100) / 2 + 15, yPosition + 8);
    
    // Fixed alignment for deductions amount column
    const deductionsStartX = 50 + (doc.page.width - 100) / 2 + 5;
    const deductionsAmountX = deductionsStartX + columnWidth - 90;
    
    doc.text('Amount', deductionsAmountX, yPosition + 8, { align: 'right', width: 80 });
    
    // Draw earnings table rows
    yPosition += columnHeaderHeight;
    let earningsY = yPosition;
    
    for (let i = 0; i < earningsRows; i++) {
      const earning = earnings[i];
      
      if (i % 2 === 0) {
        doc.rect(50, earningsY, (doc.page.width - 100) / 2 - 5, rowHeight)
           .fillAndStroke(this.colors.white, this.colors.mediumGray);
      } else {
        doc.rect(50, earningsY, (doc.page.width - 100) / 2 - 5, rowHeight)
           .fillAndStroke(this.colors.lightGray, this.colors.mediumGray);
      }
      
      doc.fillColor(this.colors.black)
         .font('Regular')
         .fontSize(9)
         .text(earning.description, 60, earningsY + 8);
      
      const formattedAmount = `${this.currencySymbols[payroll.currency] || 'QR'} ${earning.amount.toFixed(2)}`;
      doc.text(formattedAmount, earningsAmountX, earningsY + 8, { align: 'right', width: 80 });
      
      earningsY += rowHeight;
    }
    
    // Draw deductions table rows
    let deductionsY = yPosition;
    
    for (let i = 0; i < deductionsRows; i++) {
      const deduction = deductions[i];
      
      if (i % 2 === 0) {
        doc.rect(50 + (doc.page.width - 100) / 2 + 5, deductionsY, (doc.page.width - 100) / 2 - 5, rowHeight)
           .fillAndStroke(this.colors.white, this.colors.mediumGray);
      } else {
        doc.rect(50 + (doc.page.width - 100) / 2 + 5, deductionsY, (doc.page.width - 100) / 2 - 5, rowHeight)
           .fillAndStroke(this.colors.lightGray, this.colors.mediumGray);
      }
      
      doc.fillColor(this.colors.black)
         .font('Regular')
         .fontSize(9)
         .text(deduction.description, 50 + (doc.page.width - 100) / 2 + 15, deductionsY + 8);
      
      const formattedAmount = `${this.currencySymbols[payroll.currency] || 'QR'} ${deduction.amount.toFixed(2)}`;
      doc.text(formattedAmount, deductionsAmountX, deductionsY + 8, { align: 'right', width: 80 });
      
      deductionsY += rowHeight;
    }
    
    // Total row for earnings
    const totalRowPosition = yPosition + Math.max(earningsRows, deductionsRows) * rowHeight;
    
    doc.rect(50, totalRowPosition, (doc.page.width - 100) / 2 - 5, totalRowHeight)
       .fillAndStroke(this.colors.secondary, this.colors.mediumGray);
    
    doc.fillColor(this.colors.white)
       .font('Bold')
       .fontSize(10)
       .text('Total Earnings', 60, totalRowPosition + 10);
    
    const formattedTotalEarnings = `${this.currencySymbols[payroll.currency] || 'QR'} ${totalEarnings.toFixed(2)}`;
    doc.text(formattedTotalEarnings, earningsAmountX, totalRowPosition + 10, { align: 'right', width: 80 });
    
    // Total row for deductions
    doc.rect(50 + (doc.page.width - 100) / 2 + 5, totalRowPosition, (doc.page.width - 100) / 2 - 5, totalRowHeight)
       .fillAndStroke(this.colors.secondary, this.colors.mediumGray);
    
    doc.fillColor(this.colors.white)
       .font('Bold')
       .fontSize(10)
       .text('Total Deductions', 50 + (doc.page.width - 100) / 2 + 15, totalRowPosition + 10);
    
    const formattedTotalDeductions = `${this.currencySymbols[payroll.currency] || 'QR'} ${totalDeductions.toFixed(2)}`;
    doc.text(formattedTotalDeductions, deductionsAmountX, totalRowPosition + 10, { align: 'right', width: 80 });
    
    // Return the total height used
    return headerHeight + columnHeaderHeight + (Math.max(earningsRows, deductionsRows) * rowHeight) + totalRowHeight;
  }

  private drawSummary(doc: any, payroll: Payroll, yPosition: number): void {
    // Calculate totals
    
    const netPay = Number(payroll.netSalary);

    
    // Net pay section with highlighted background
    doc.rect(50, yPosition, doc.page.width - 100, 60)
       .fillAndStroke(this.colors.primary, this.colors.mediumGray);
    
    // NET PAY label on the left
    doc.fillColor(this.colors.white)
       .font('Bold')
       .fontSize(14)
       .text('NET PAY', 60, yPosition + 15);
    
    // Format net pay with currency symbol
    const formattedNetPay = `${this.currencySymbols[payroll.currency] || 'QR'} ${netPay.toFixed(2)}`;
    
    // Calculate proper alignment position for the amount
    const amountX = doc.page.width - 170;
    
    doc.font('Bold')
       .fontSize(16)
       .text(formattedNetPay, amountX, yPosition + 15, { 
         align: 'right',
         width: 100
       });
    
    // Add a dividing line for the amount in words section
    doc.strokeColor(this.colors.white)
       .lineWidth(0.5)
       .moveTo(60, yPosition + 35)
       .lineTo(doc.page.width - 60, yPosition + 35)
       .stroke();
    
    // Add amount in words with proper spacing (shorter text to fit)
    doc.font('Italic')
       .fontSize(9) // Reduced font size
       .text(
         `Amount in words: ${this.numberToWords(netPay, payroll)}`,
         60,
         yPosition + 42,
         { 
           width: doc.page.width - 120,
           align: 'center'
         }
       );
  }

  private drawAdditionalInfo(doc: any, payroll: Payroll, employee: Employee, org: Organization, yPosition: number): void {
    // Draw a light background for notes
    doc.rect(50, yPosition, doc.page.width - 100, 80)
       .fillAndStroke(this.colors.light, this.colors.mediumGray);
    
    // Add notes and additional information - more compact
    doc.fillColor(this.colors.black)
       .font('Bold')
       .fontSize(9) // Reduced font size
       .text('Notes & Additional Information', 60, yPosition + 8)
       .font('Regular')
       .fontSize(8) // Reduced font size
       .text([
         '• This is a computer-generated payslip and does not require a signature.',
         '• Please report any discrepancies to the HR department within 5 working days.',
         `• For any queries, please contact: hr@auxaitech.com or +974 123 4567 ext. 8900`,
         '• This payslip is confidential and for your personal use only.',
       ].join('\n'), 60, yPosition + 20);
  }

  private drawFooter(doc: any): void {
    const yPosition = doc.page.height - 50;
    
    // Add footer with page number and timestamp
    doc.rect(0, yPosition, doc.page.width, 50)
       .fill(this.colors.primary);
    
    doc.fillColor(this.colors.white)
       .font('Regular')
       .fontSize(8)
       .text(
         `Generated on: ${format(new Date(), 'dd MMM yyyy HH:mm:ss')} | Page 1 of 1`,
         0,
         yPosition + 20,
         { align: 'center', width: doc.page.width }
       );
  }

  async getSignedPayslipUrl(payslipId: number): Promise<string> {
    const payslip = await this.payslipRepository.findOne({ where: { id: payslipId } });
    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }
    const key = payslip.pdfUrl.split('/').slice(-2).join('/');
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  async configureS3LifecyclePolicy(): Promise<void> {
    try {
      await this.s3Client.send(
        new PutBucketLifecycleConfigurationCommand({
          Bucket: process.env.S3_BUCKET,
          LifecycleConfiguration: {
            Rules: [
              {
                ID: 'MovePayslipsToGlacier',
                Status: 'Enabled',
                Filter: { Prefix: 'payslips/' },
                Transitions: [
                  {
                    Days: 365,
                    StorageClass: 'GLACIER',
                  },
                ],
              },
              {
                ID: 'DeletePayslipsAfter7Years',
                Status: 'Enabled',
                Filter: { Prefix: 'payslips/' },
                Expiration: {
                  Days: 2555,
                },
              },
            ],
          },
        }),
      );
      this.logger.log('S3 lifecycle policy configured successfully');
    } catch (error) {
      this.logger.error(`Failed to configure S3 lifecycle policy: ${error.message}`);
      throw error;
    }
  }

  private numberToWords(amount: number, payroll: Payroll): string {
    const units = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = [
      '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];

    const convertHundreds = (num: number) => {
      if (num === 0) return '';
      if (num < 20) return units[num] + ' ';
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + units[num % 10] : '') + ' ';
      return units[Math.floor(num / 100)] + ' Hundred ' + convertHundreds(num % 100);
    };

    const convert = (num: number) => {
      if (num === 0) return 'Zero';
      let words = '';
      
      // Shorter version to save space
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

    // Get the currency name based on the currency code
    const currencyNames: { [key: string]: string } = {
      USD: 'Dollars',
      EUR: 'Euros',
      INR: 'Rupees',
      GBP: 'Pounds',
      AUD: 'AUD',
      CAD: 'CAD',
      QAR: 'QAR',
    };

    const currencyName = currencyNames[payroll.currency] || 'QAR';
    return `${convert(Math.floor(amount))} ${currencyName}`;
  }

}