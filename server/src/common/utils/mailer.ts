import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail", // or use "smtp.ethereal.email" for dev
  auth: {
    user: process.env.SMTP_USER, // your email
    pass: process.env.SMTP_PASS, // app password or real pass
  },
});

/**
 * Sends an employee invitation email
 */
export const sendInviteEmail = async (email: string, inviteLink: string) => {
  const mailOptions = {
    from: `"HR Nexus" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "You're Invited to Join HR Nexus",
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
        <h2 style="color: #1e40af;">You're invited to join an organisation on HR Nexus</h2>
        <p>Hi,</p>
        <p>You have been invited to join an organisation on <strong>HR Nexus</strong>.</p>
        <p>Click the button below to accept the invitation and complete your registration:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #1e40af; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none;">
            Accept Invitation
          </a>
        </p>
        <p>If you did not expect this email, you can safely ignore it.</p>
        <hr style="margin-top: 30px;" />
        <p style="font-size: 12px; color: #888;">HR Nexus – Employee & Organisation Management</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
