import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SES } from 'aws-sdk';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
   
      // Fallback to traditional SMTP configuration
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
     
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
      cc?: string | string[],
      bcc?: string | string[],
      attachments?: nodemailer.Attachment[],
      replyTo?: string,
      from?: string,
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
   * Send an email using a template
   * This method is specifically for AWS SES templates
   */
  async sendTemplateEmail(
    to: string | string[],
    templateName: string,
    templateData: Record<string, any>,
    options?: {
      cc?: string | string[],
      bcc?: string | string[],
      from?: string,
    }
  ) {
    if (process.env.USE_AWS_SES !== 'true') {
      throw new Error('Template emails are only supported with AWS SES');
    }

    try {
      const { cc, bcc, from } = options || {};
      const ses = new SES({
        apiVersion: '2010-12-01',
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      const params = {
        Source: from || process.env.EMAIL_FROM || process.env.SMTP_USER,
        Template: templateName,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to],
          CcAddresses: cc ? (Array.isArray(cc) ? cc : [cc]) : [],
          BccAddresses: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [],
        },
        TemplateData: JSON.stringify(templateData),
      };

      const result = await ses.sendTemplatedEmail(params).promise();
      this.logger.log(`Template email sent successfully: ${result.MessageId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error sending template email: ${error.message}`, error.stack);
      throw new Error(`Failed to send template email: ${error.message}`);
    }
  }

  /**
   * Check email service health
   * This can be used in health checks
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error(`Email service health check failed: ${error.message}`);
      return false;
    }
  }
}