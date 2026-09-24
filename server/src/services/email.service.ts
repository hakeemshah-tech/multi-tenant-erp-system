import nodemailer from "nodemailer";
import { User } from "../database/models/user.model";

interface EmailTransporter {
  sendMail(options: any): Promise<any>;
  verify(): Promise<boolean>;
}

class EmailService {
  private transporter: EmailTransporter;
  private smtpConfigured: boolean;

  constructor() {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    this.smtpConfigured = !!(smtpUser && smtpPass);

    if (!this.smtpConfigured) {
      console.warn(
        `[EMAIL SERVICE] ⚠️ SMTP not configured - SMTP_USER: ${
          smtpUser ? "SET" : "NOT SET"
        }, SMTP_PASS: ${smtpPass ? "SET" : "NOT SET"}`
      );
      console.warn(
        `[EMAIL SERVICE] Email sending will fail until SMTP credentials are configured in environment variables`
      );
    } else {
      console.log(
        `[EMAIL SERVICE] ✅ SMTP configured - Service: gmail, User: ${smtpUser}`
      );
    }

    // Defaults to the previous Gmail behaviour when SMTP_HOST is unset, so an
    // existing deployment keeps working, while any SMTP provider can be used
    // by supplying host/port instead.
    const smtpHost = process.env.SMTP_HOST;

    this.transporter = nodemailer.createTransport(
      smtpHost
        ? {
            host: smtpHost,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === "true",
            auth: { user: smtpUser, pass: smtpPass },
          }
        : {
            service: "gmail",
            auth: { user: smtpUser, pass: smtpPass },
          }
    );

    // Verify SMTP connection on initialization
    this.verifyConnection().catch((error) => {
      console.error(
        `[EMAIL SERVICE] ❌ SMTP connection verification failed:`,
        error.message
      );
    });
  }

  /**
   * Verify SMTP connection
   */
  private async verifyConnection(): Promise<void> {
    if (!this.smtpConfigured) {
      console.warn(
        `[EMAIL SERVICE] ⚠️ Skipping SMTP verification - credentials not configured`
      );
      return;
    }

    try {
      await this.transporter.verify();
      console.log(`[EMAIL SERVICE] ✅ SMTP connection verified successfully`);
    } catch (error: any) {
      console.error(`[EMAIL SERVICE] ❌ SMTP connection verification failed:`, {
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
      });
      throw error;
    }
  }

  /**
   * Send pre-expiry notification to employee
   */
  async sendPreExpiryNotificationToEmployee(params: {
    employeeEmail: string;
    employeeName: string;
    documentType: string;
    expiryDate: Date;
    daysUntilExpiry: number;
    tenantName?: string;
  }) {
    const template = this.getPreExpiryEmployeeTemplate(params);

    await this.sendEmail({
      to: params.employeeEmail,
      subject: `⚠️ Document Expiring Soon: ${params.documentType}`,
      html: template,
    });
  }

  /**
   * Send expiry notification to employee
   */
  async sendExpiryNotificationToEmployee(params: {
    employeeEmail: string;
    employeeName: string;
    documentType: string;
    expiryDate: Date;
    tenantName?: string;
  }) {
    const template = this.getExpiryEmployeeTemplate(params);

    await this.sendEmail({
      to: params.employeeEmail,
      subject: `🚨 Document Expired: ${params.documentType}`,
      html: template,
    });
  }

  /**
   * Send pre-expiry notification to employer
   */
  async sendPreExpiryNotificationToEmployer(params: {
    employerEmail: string;
    employerName: string;
    employeeName: string;
    documentType: string;
    expiryDate: Date;
    daysUntilExpiry: number;
    tenantName?: string;
  }) {
    const template = this.getPreExpiryEmployerTemplate(params);

    await this.sendEmail({
      to: params.employerEmail,
      subject: `📋 Employee Document Expiring Soon: ${params.employeeName}`,
      html: template,
    });
  }

  /**
   * Send expiry notification to employer
   */
  async sendExpiryNotificationToEmployer(params: {
    employerEmail: string;
    employerName: string;
    employeeName: string;
    documentType: string;
    expiryDate: Date;
    tenantName?: string;
  }) {
    const template = this.getExpiryEmployerTemplate(params);

    await this.sendEmail({
      to: params.employerEmail,
      subject: `🚨 Employee Document Expired: ${params.employeeName}`,
      html: template,
    });
  }

  /**
   * Generic email sending method
   */
  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
  }) {
    // Validate recipient email
    if (
      !options.to ||
      typeof options.to !== "string" ||
      options.to.trim().length === 0
    ) {
      const error = new Error(
        "No recipients defined - email address is required"
      );
      console.error(`[EMAIL SERVICE] ❌ Cannot send email:`, {
        error: error.message,
        recipient: options.to,
        subject: options.subject,
      });
      throw error;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedTo = options.to.trim();
    if (!emailRegex.test(normalizedTo)) {
      const error = new Error(`Invalid recipient email format: ${options.to}`);
      console.error(`[EMAIL SERVICE] ❌ Cannot send email:`, {
        error: error.message,
        recipient: options.to,
        subject: options.subject,
      });
      throw error;
    }

    if (!this.smtpConfigured) {
      const error = new Error(
        "SMTP not configured - SMTP_USER and SMTP_PASS environment variables must be set"
      );
      console.error(`[EMAIL SERVICE] ❌ Cannot send email:`, {
        error: error.message,
        recipient: normalizedTo,
        subject: options.subject,
      });
      throw error;
    }

    const mailOptions = {
      from: `"HR Nexus" <${process.env.SMTP_USER}>`,
      to: normalizedTo,
      subject: options.subject,
      html: options.html,
    };

    console.log(`[EMAIL SERVICE] SMTP Configuration:`, {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      smtpUser: process.env.SMTP_USER || "NOT SET",
      smtpService: "gmail",
      smtpConfigured: this.smtpConfigured,
    });

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`[EMAIL SERVICE] ✅ SMTP sendMail success:`, {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        response: result.response,
        pending: result.pending,
      });
      return result;
    } catch (error: any) {
      console.error(`[EMAIL SERVICE] ❌ SMTP sendMail error:`, {
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        recipient: options.to,
        subject: options.subject,
        smtpUser: process.env.SMTP_USER || "NOT SET",
        stack: error.stack,
      });

      // Provide helpful error messages for common issues
      if (error.code === "EAUTH") {
        console.error(
          `[EMAIL SERVICE] 🔐 Authentication failed - Check SMTP_USER and SMTP_PASS credentials`
        );
      } else if (error.code === "ECONNECTION") {
        console.error(
          `[EMAIL SERVICE] 🌐 Connection failed - Check network connectivity and SMTP service availability`
        );
      } else if (error.code === "ETIMEDOUT") {
        console.error(
          `[EMAIL SERVICE] ⏱️ Connection timeout - SMTP server may be unreachable`
        );
      }

      throw error;
    }
  }

  /**
   * Pre-expiry email template for employees
   */
  private getPreExpiryEmployeeTemplate(params: any): string {
    const {
      employeeName,
      documentType,
      expiryDate,
      daysUntilExpiry,
      tenantName,
    } = params;

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #fbbf24, #f59e0b); padding: 30px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">⚠️ Document Expiring Soon</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">Hello ${employeeName},</h2>
          
          <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Your <strong style="color: #f59e0b;">${documentType}</strong> document will expire in 
            <span style="color: #f59e0b; font-weight: bold; font-size: 18px;">${daysUntilExpiry} days</span> 
            on <strong>${expiryDate.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}</strong>.
          </p>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 25px 0;">
            <h3 style="color: #92400e; margin-top: 0; font-size: 18px;">📋 What you need to do:</h3>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Upload a new document before the expiry date</li>
              <li style="margin-bottom: 8px;">Ensure the document is clear and readable</li>
              <li style="margin-bottom: 8px;">Contact your employer if you have any questions</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/nexus-profile" 
               style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
              📤 Upload New Document
            </a>
          </div>
          
          ${
            tenantName
              ? `
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 25px;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>Organisation:</strong> ${tenantName}
            </p>
          </div>
          `
              : ""
          }
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px;">
          <p style="margin: 0;">This is an automated notification from HR Nexus</p>
          <p style="margin: 5px 0 0 0;">If you have any questions, please contact your employer.</p>
        </div>
      </div>
    `;
  }

  /**
   * Expiry email template for employees
   */
  private getExpiryEmployeeTemplate(params: any): string {
    const { employeeName, documentType, expiryDate, tenantName } = params;

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">🚨 Document Expired</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">Hello ${employeeName},</h2>
          
          <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Your <strong style="color: #ef4444;">${documentType}</strong> document has expired on 
            <span style="color: #ef4444; font-weight: bold;">${expiryDate.toLocaleDateString(
              "en-US",
              {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              }
            )}</span>.
          </p>
          
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 25px 0;">
            <h3 style="color: #dc2626; margin-top: 0; font-size: 18px;">⚠️ Action Required:</h3>
            <ul style="color: #dc2626; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Upload a new document immediately</li>
              <li style="margin-bottom: 8px;">Your document status is now "Expired"</li>
              <li style="margin-bottom: 8px;">This may affect your employment status</li>
              <li style="margin-bottom: 8px;">Contact your employer for urgent assistance</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/nexus-profile" 
               style="background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
              🚨 Upload New Document Now
            </a>
          </div>
          
          ${
            tenantName
              ? `
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 25px;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>Organisation:</strong> ${tenantName}
            </p>
          </div>
          `
              : ""
          }
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px;">
          <p style="margin: 0;">This is an automated notification from HR Nexus</p>
          <p style="margin: 5px 0 0 0; color: #ef4444; font-weight: bold;">Please take immediate action to avoid any issues.</p>
        </div>
      </div>
    `;
  }

  /**
   * Pre-expiry email template for employers
   */
  private getPreExpiryEmployerTemplate(params: any): string {
    const {
      employerName,
      employeeName,
      documentType,
      expiryDate,
      daysUntilExpiry,
      tenantName,
    } = params;

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">📋 Employee Document Expiring Soon</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">Hello ${employerName},</h2>
          
          <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            <strong style="color: #3b82f6;">${employeeName}</strong>'s <strong>${documentType}</strong> document will expire in 
            <span style="color: #f59e0b; font-weight: bold; font-size: 18px;">${daysUntilExpiry} days</span> 
            on <strong>${expiryDate.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}</strong>.
          </p>
          
          <div style="background: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 25px 0;">
            <h3 style="color: #1e40af; margin-top: 0; font-size: 18px;">📋 Recommended Actions:</h3>
            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Notify the employee about the upcoming expiry</li>
              <li style="margin-bottom: 8px;">Remind them to upload a new document</li>
              <li style="margin-bottom: 8px;">Follow up if no action is taken</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/tenant/employees" 
               style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
              👥 Manage Employee Documents
            </a>
          </div>
          
          ${
            tenantName
              ? `
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 25px;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>Organisation:</strong> ${tenantName}
            </p>
          </div>
          `
              : ""
          }
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px;">
          <p style="margin: 0;">This is an automated notification from HR Nexus</p>
          <p style="margin: 5px 0 0 0;">Manage your team's document compliance efficiently.</p>
        </div>
      </div>
    `;
  }

  /**
   * Expiry email template for employers
   */
  private getExpiryEmployerTemplate(params: any): string {
    const { employerName, employeeName, documentType, expiryDate, tenantName } =
      params;

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">🚨 Employee Document Expired</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">Hello ${employerName},</h2>
          
          <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            <strong style="color: #ef4444;">${employeeName}</strong>'s <strong>${documentType}</strong> document has expired on 
            <span style="color: #ef4444; font-weight: bold;">${expiryDate.toLocaleDateString(
              "en-US",
              {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              }
            )}</span>.
          </p>
          
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 25px 0;">
            <h3 style="color: #dc2626; margin-top: 0; font-size: 18px;">🚨 Immediate Action Required:</h3>
            <ul style="color: #dc2626; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">Contact the employee immediately</li>
              <li style="margin-bottom: 8px;">Request urgent document renewal</li>
              <li style="margin-bottom: 8px;">Consider employment status implications</li>
              <li style="margin-bottom: 8px;">Update compliance records</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/tenant/employees" 
               style="background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
              🚨 Manage Employee Documents
            </a>
          </div>
          
          ${
            tenantName
              ? `
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 25px;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              <strong>Organisation:</strong> ${tenantName}
            </p>
          </div>
          `
              : ""
          }
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px;">
          <p style="margin: 0;">This is an automated notification from HR Nexus</p>
          <p style="margin: 5px 0 0 0; color: #ef4444; font-weight: bold;">Immediate action required to maintain compliance.</p>
        </div>
      </div>
    `;
  }

  /**
   * Send contract notification email to applicant
   */
  async sendContractToApplicantEmail(params: {
    applicantEmail: string;
    applicantName: string;
    contractTitle: string;
    contractVersion?: string;
    viewContractLink: string;
    isResend?: boolean;
    tenantName?: string;
    organizationName?: string;
  }) {
    console.log(`[EMAIL SERVICE] 📧 Preparing to send contract email:`, {
      recipientEmail: params.applicantEmail,
      recipientName: params.applicantName,
      contractTitle: params.contractTitle,
      contractVersion: params.contractVersion || "N/A",
      isResend: params.isResend || false,
      organizationName: params.organizationName || "N/A",
    });

    const template = this.getContractToApplicantTemplate(params);

    const subject = params.isResend
      ? `📄 Contract Resent: ${params.contractTitle}`
      : `📄 Contract Ready for Review: ${params.contractTitle}`;

    console.log(`[EMAIL SERVICE] Email subject: "${subject}"`);
    console.log(
      `[EMAIL SERVICE] Sending email via SMTP to: ${params.applicantEmail}`
    );

    try {
      await this.sendEmail({
        to: params.applicantEmail,
        subject,
        html: template,
      });

      console.log(
        `[EMAIL SERVICE] ✅ Email sent successfully via SMTP to: ${params.applicantEmail}`
      );
    } catch (error: any) {
      console.error(`[EMAIL SERVICE] ❌ Failed to send email via SMTP:`, {
        recipientEmail: params.applicantEmail,
        error: error.message,
        stack: error.stack,
        smtpUser: process.env.SMTP_USER || "NOT SET",
        smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      });
      throw error; // Re-throw to be caught by caller
    }
  }

  /**
   * Contract to applicant email template
   */
  private getContractToApplicantTemplate(params: any): string {
    const {
      applicantName,
      contractTitle,
      contractVersion,
      viewContractLink,
      publicViewContractLink,
      isResend,
      tenantName,
      organizationName,
    } = params;

    const orgName = organizationName || tenantName || "the organization";
    const versionText = contractVersion ? ` (Version ${contractVersion})` : "";

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contract Ready for Review</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <!-- Header with gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
                    <div style="color: #ffffff; font-size: 32px; margin-bottom: 10px;">📄</div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; line-height: 1.2;">
                      ${
                        isResend
                          ? "Contract Resent for Review"
                          : "Contract Ready for Review"
                      }
                    </h1>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #1f2937; margin-top: 0; font-size: 24px; font-weight: 600; line-height: 1.3;">
                      Hello ${applicantName || "there"},
                    </h2>
                    
                    <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                      ${
                        isResend
                          ? `Your contract has been resent for your review. Please take a moment to review the contract details and respond accordingly.`
                          : `Great news! Your contract has been fully approved and is now ready for your review.`
                      }
                    </p>

                    <!-- Contract Details Card -->
                    <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-left: 4px solid #3b82f6; padding: 24px; border-radius: 8px; margin: 30px 0;">
                      <h3 style="color: #1e40af; margin-top: 0; font-size: 18px; font-weight: 600; margin-bottom: 12px;">
                        📋 Contract Details
                      </h3>
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #4b5563; font-size: 15px;">
                            <strong style="color: #1f2937;">Contract Title:</strong>
                          </td>
                          <td style="padding: 8px 0; color: #1f2937; font-size: 15px; font-weight: 600; text-align: right;">
                            ${contractTitle}${versionText}
                          </td>
                        </tr>
                        ${
                          orgName
                            ? `
                        <tr>
                          <td style="padding: 8px 0; color: #4b5563; font-size: 15px;">
                            <strong style="color: #1f2937;">Organization:</strong>
                          </td>
                          <td style="padding: 8px 0; color: #1f2937; font-size: 15px; font-weight: 600; text-align: right;">
                            ${orgName}
                          </td>
                        </tr>
                        `
                            : ""
                        }
                      </table>
                    </div>

                    <!-- Action Required Section -->
                    <div style="background: #f9fafb; padding: 24px; border-radius: 8px; margin: 30px 0; border: 1px solid #e5e7eb;">
                      <h3 style="color: #1f2937; margin-top: 0; font-size: 18px; font-weight: 600; margin-bottom: 16px;">
                        ✨ What You Need to Do:
                      </h3>
                      <ol style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 24px;">
                        <li style="margin-bottom: 12px;">
                          <strong style="color: #1f2937;">Review the Contract:</strong> Click the button below to view the complete contract details
                        </li>
                        <li style="margin-bottom: 12px;">
                          <strong style="color: #1f2937;">Make Your Decision:</strong> After reviewing, you can accept or reject the contract
                        </li>
                        <li style="margin-bottom: 0;">
                          <strong style="color: #1f2937;">Add Notes (Optional):</strong> You can include any comments or questions when responding
                        </li>
                      </ol>
                    </div>

                    <!-- CTA Buttons -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                      <tr>
                        <td style="text-align: center; padding: 10px;">
                          <a href="${viewContractLink}" 
                             style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); margin: 5px;">
                            👁️ View Contract
                          </a>
                        </td>
                      </tr>
                      ${
                        publicViewContractLink
                          ? `
                      <tr>
                        <td style="text-align: center; padding: 10px;">
                          <a href="${publicViewContractLink}" 
                             style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3); margin: 5px;">
                            🔓 View Contract Without Login
                          </a>
                        </td>
                      </tr>
                      `
                          : ""
                      }
                    </table>

                    <!-- Instructions -->
                    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 30px 0;">
                      <p style="color: #92400e; font-size: 14px; line-height: 1.6; margin: 0;">
                        <strong>💡 Tip:</strong> After viewing the contract, you'll be able to accept or reject it directly from your "My Contracts" section. Make sure to review all terms and conditions carefully before making your decision.
                      </p>
                    </div>

                    ${
                      orgName
                        ? `
                    <!-- Organization Info -->
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-top: 30px; text-align: center;">
                      <p style="color: #6b7280; font-size: 14px; margin: 0;">
                        <strong style="color: #1f2937;">Organization:</strong> ${orgName}
                      </p>
                    </div>
                    `
                        : ""
                    }

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px; margin: 0 0 10px 0;">
                      This is an automated notification from <strong style="color: #3b82f6;">HR Nexus</strong>
                    </p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                      If you have any questions about this contract, please contact your employer or HR representative.
                    </p>
                    <p style="color: #d1d5db; font-size: 11px; margin: 15px 0 0 0;">
                      © ${new Date().getFullYear()} HR Nexus – Employee & Organisation Management
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Get document type from field key
   */
  /**
   * Send OTP verification email
   */
  async sendOTPEmail(params: {
    email: string;
    otpCode: string;
    userName?: string;
  }) {
    // Validate params
    if (!params || typeof params !== "object") {
      throw new Error("Invalid email parameters: params must be an object");
    }

    if (
      !params.email ||
      typeof params.email !== "string" ||
      params.email.trim().length === 0
    ) {
      throw new Error(
        `Invalid email parameter: email is required and must be a valid string. Received: ${JSON.stringify(
          params.email
        )}`
      );
    }

    if (
      !params.otpCode ||
      typeof params.otpCode !== "string" ||
      params.otpCode.trim().length === 0
    ) {
      throw new Error(
        "Invalid OTP code: otpCode is required and must be a valid string"
      );
    }

    const normalizedEmail = params.email.trim();
    const template = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Verify Your Email Address</h2>
        <p>Hi${params.userName ? ` ${params.userName}` : ""},</p>
        <p>Thank you for registering with <strong>HR Nexus</strong>. Please verify your email address by entering the OTP code below:</p>
        <div style="background-color: #f3f4f6; border: 2px solid #1e40af; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af; font-family: monospace;">
            ${params.otpCode}
          </div>
        </div>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <p>If you did not create an account with HR Nexus, please ignore this email.</p>
        <hr style="margin-top: 30px;" />
        <p style="font-size: 12px; color: #888;">HR Nexus – Employee & Organisation Management</p>
      </div>
    `;

    await this.sendEmail({
      to: normalizedEmail,
      subject: "Verify Your Email - HR Nexus",
      html: template,
    });
  }

  /**
   * Send password reset OTP email
   */
  async sendPasswordResetOTPEmail(params: {
    email: string;
    otpCode: string;
    userName?: string;
  }) {
    // Validate params
    if (!params || typeof params !== "object") {
      throw new Error("Invalid email parameters: params must be an object");
    }

    if (
      !params.email ||
      typeof params.email !== "string" ||
      params.email.trim().length === 0
    ) {
      throw new Error(
        `Invalid email parameter: email is required and must be a valid string. Received: ${JSON.stringify(
          params.email
        )}`
      );
    }

    if (
      !params.otpCode ||
      typeof params.otpCode !== "string" ||
      params.otpCode.trim().length === 0
    ) {
      throw new Error(
        "Invalid OTP code: otpCode is required and must be a valid string"
      );
    }

    const normalizedEmail = params.email.trim();
    const template = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">🔐 Password Reset Request</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">Hello${
            params.userName ? ` ${params.userName}` : ""
          },</h2>
          
          <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            We received a request to reset your password for your <strong>HR Nexus</strong> account. 
            Please use the OTP code below to verify your identity and reset your password.
          </p>
          
          <div style="background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 2px solid #3b82f6; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
            <p style="color: #1e40af; font-size: 14px; font-weight: 600; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #1e40af; font-family: monospace; margin: 10px 0;">
              ${params.otpCode}
            </div>
          </div>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 25px 0;">
            <h3 style="color: #92400e; margin-top: 0; font-size: 18px;">⚠️ Security Notice:</h3>
            <ul style="color: #92400e; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">This code will expire in <strong>10 minutes</strong></li>
              <li style="margin-bottom: 8px;">Never share this code with anyone</li>
              <li style="margin-bottom: 8px;">If you didn't request this, please ignore this email</li>
            </ul>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 25px;">
            If you did not request a password reset, please ignore this email. Your password will remain unchanged.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 14px;">
          <p style="margin: 0;">This is an automated email from HR Nexus</p>
          <p style="margin: 5px 0 0 0;">For security reasons, please do not reply to this email.</p>
        </div>
      </div>
    `;

    await this.sendEmail({
      to: normalizedEmail,
      subject: "Password Reset Request - HR Nexus",
      html: template,
    });
  }

  getDocumentTypeFromField(fieldKey: string): string {
    const typeMap: { [key: string]: string } = {
      passport: "Passport",
      driverslicense: "Driver's License",
      nationalid: "National ID",
      birthcertificate: "Birth Certificate",
      cpr: "CPR Certificate",
      firstaid: "First Aid Certificate",
      policeclearancecertificate: "Police Clearance Certificate",
      ndisscreensingcheck: "NDIS Screening Check",
      covid19vaccinationcertificate: "COVID-19 Vaccination Certificate",
      workpermit: "Work Permit",
      visa: "Visa",
      // Add more mappings as needed
    };

    return typeMap[fieldKey] || fieldKey.replace(/([A-Z])/g, " $1").trim();
  }

  /**
   * Send OTP email to recipient (for contract actions)
   */
  async sendContractOTPEmail(params: {
    recipientEmail: string;
    recipientName: string;
    otpCode: string;
  }) {
    // Validate params
    if (!params || typeof params !== "object") {
      throw new Error("Invalid email parameters: params must be an object");
    }

    if (
      !params.recipientEmail ||
      typeof params.recipientEmail !== "string" ||
      params.recipientEmail.trim().length === 0
    ) {
      throw new Error(
        `Invalid recipient email: recipientEmail is required and must be a valid string. Received: ${JSON.stringify(
          params.recipientEmail
        )}`
      );
    }

    if (
      !params.otpCode ||
      typeof params.otpCode !== "string" ||
      params.otpCode.trim().length === 0
    ) {
      throw new Error(
        "Invalid OTP code: otpCode is required and must be a valid string"
      );
    }

    const normalizedEmail = params.recipientEmail.trim();
    const template = this.getOTPEmailTemplate(params);

    const subject = `🔐 Your OTP Code for Contract Action`;

    try {
      await this.sendEmail({
        to: normalizedEmail,
        subject,
        html: template,
      });

      console.log(
        `[EMAIL SERVICE] ✅ OTP email sent successfully to: ${params.recipientEmail}`
      );
    } catch (error: any) {
      console.error(`[EMAIL SERVICE] ❌ Failed to send OTP email:`, {
        recipientEmail: params.recipientEmail,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * OTP email template
   */
  private getOTPEmailTemplate(params: {
    recipientName: string;
    otpCode: string;
  }): string {
    const { recipientName, otpCode } = params;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OTP Code for Contract Action</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
                    <div style="color: #ffffff; font-size: 32px; margin-bottom: 10px;">🔐</div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; line-height: 1.2;">
                      OTP Verification Code
                    </h1>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #1f2937; margin-top: 0; font-size: 24px; font-weight: 600; line-height: 1.3;">
                      Hello ${recipientName || "there"},
                    </h2>
                    
                    <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                      You have requested to take action on your contract. Please use the following OTP code to complete your action:
                    </p>

                    <!-- OTP Code Box -->
                    <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #3b82f6; padding: 30px; border-radius: 12px; margin: 30px 0; text-align: center;">
                      <p style="color: #1e40af; font-size: 14px; font-weight: 600; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">
                        Your OTP Code
                      </p>
                      <div style="font-size: 48px; font-weight: 700; color: #1e40af; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                        ${otpCode}
                      </div>
                    </div>

                    <!-- Security Notice -->
                    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 30px 0;">
                      <p style="color: #92400e; font-size: 14px; line-height: 1.6; margin: 0;">
                        <strong>⚠️ Security Notice:</strong> This OTP code will expire in 10 minutes. Do not share this code with anyone. If you did not request this code, please ignore this email.
                      </p>
                    </div>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px; margin: 0 0 10px 0;">
                      This is an automated notification from <strong style="color: #3b82f6;">HR Nexus</strong>
                    </p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                      If you have any questions, please contact your employer or HR representative.
                    </p>
                    <p style="color: #d1d5db; font-size: 11px; margin: 15px 0 0 0;">
                      © ${new Date().getFullYear()} HR Nexus – Employee & Organisation Management
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
