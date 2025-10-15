import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.logger.log('Email service initialized with SMTP configuration');
  }

  /**
   * Send an email with optional attachments
   * 
   * @param to - Recipient email address(es)
   * @param subject - Email subject
   * @param text - Plain text email body
   * @param html - HTML email body (optional)
   * @param options - Additional email options (cc, bcc, attachments, etc.)
   * @returns The nodemailer info object
   */
  async sendMail(
    to: string | string[],
    subject: string,
    text: string,
    html?: string,
    options?: {
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: nodemailer.Attachment[];
      replyTo?: string;
      from?: string;
    }
  ) {
    try {
      const { cc, bcc, attachments, replyTo, from } = options || {};

      const mailOptions: nodemailer.SendMailOptions = {
        from: from || process.env.EMAIL_FROM || process.env.SMTP_USER,
        to,
        cc,
        bcc,
        subject,
        text,
        html,
        attachments,
        replyTo,
      };

      // Remove undefined fields
      Object.keys(mailOptions).forEach(key => 
        mailOptions[key] === undefined && delete mailOptions[key]
      );

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`, error.stack);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send a batch of emails
   * 
   * @param recipients - Array of recipient email addresses
   * @param subject - Email subject
   * @param text - Plain text email body
   * @param html - HTML email body (optional)
   * @param options - Additional email options
   * @returns Array of nodemailer info objects
   */
  async sendBatchMail(
    recipients: string[],
    subject: string,
    text: string,
    html?: string,
    options?: {
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: nodemailer.Attachment[];
      replyTo?: string;
      from?: string;
    }
  ) {
    try {
      const results = [];
      for (const recipient of recipients) {
        const info = await this.sendMail(recipient, subject, text, html, options);
        results.push(info);
      }
      this.logger.log(`Batch email sent to ${results.length} recipients`);
      return results;
    } catch (error) {
      this.logger.error(`Error sending batch email: ${error.message}`, error.stack);
      throw new Error(`Failed to send batch email: ${error.message}`);
    }
  }

  /**
   * Send an email using template variables
   * Replaces {{variable}} placeholders in the template
   * 
   * @param to - Recipient email address(es)
   * @param subject - Email subject (supports template variables)
   * @param textTemplate - Plain text template with {{variable}} placeholders
   * @param htmlTemplate - HTML template with {{variable}} placeholders (optional)
   * @param templateData - Object containing variable values
   * @param options - Additional email options
   * @returns The nodemailer info object
   */
  async sendTemplateEmail(
    to: string | string[],
    subject: string,
    textTemplate: string,
    htmlTemplate: string,
    templateData: Record<string, any>,
    options?: {
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: nodemailer.Attachment[];
      replyTo?: string;
      from?: string;
    }
  ) {
    try {
      const interpolateTemplate = (template: string, data: Record<string, any>): string => {
        return template.replace(/{{(\w+)}}/g, (match, key) => {
          return data[key] !== undefined ? String(data[key]) : match;
        });
      };

      const interpolatedSubject = interpolateTemplate(subject, templateData);
      const interpolatedText = interpolateTemplate(textTemplate, templateData);
      const interpolatedHtml = htmlTemplate ? interpolateTemplate(htmlTemplate, templateData) : undefined;

      return await this.sendMail(
        to,
        interpolatedSubject,
        interpolatedText,
        interpolatedHtml,
        options
      );
    } catch (error) {
      this.logger.error(`Error sending template email: ${error.message}`, error.stack);
      throw new Error(`Failed to send template email: ${error.message}`);
    }
  }

  /**
   * Check email service health
   * Used for health checks
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('Email service health check passed');
      return true;
    } catch (error) {
      this.logger.error(`Email service health check failed: ${error.message}`);
      return false;
    }
  }
}