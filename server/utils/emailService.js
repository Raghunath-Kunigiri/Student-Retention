const nodemailer = require('nodemailer');

// Create transporter - configure based on your email service
// For development, you can use Gmail, SendGrid, or any SMTP service
const createTransporter = () => {
  // Check if email credentials are configured
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASSWORD;
  const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const emailPort = process.env.EMAIL_PORT || 587;

  if (!emailUser || !emailPass) {
    console.warn('Email credentials not configured. Email notifications will be disabled.');
    return null;
  }

  return nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });
};

const transporter = createTransporter();

/**
 * Send email notification to advisor about student help request
 */
async function sendHelpRequestNotification(advisorEmail, advisorName, studentName, studentId, requestData) {
  if (!transporter) {
    console.log('Email service not configured. Skipping email notification.');
    return false;
  }

  try {
    const { category, subject, details, urgency } = requestData;
    
    const mailOptions = {
      from: `"Horizon State University" <${process.env.EMAIL_USER}>`,
      to: advisorEmail,
      subject: `New Help Request from ${studentName} (Student ID: ${studentId})`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .info-box { background: white; padding: 15px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #0d47a1; }
            .label { font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; }
            .value { color: #1f2937; margin-top: 5px; }
            .urgency { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
            .urgency.high { background: #fee2e2; color: #991b1b; }
            .urgency.normal { background: #fef3c7; color: #92400e; }
            .urgency.low { background: #d1fae5; color: #166534; }
            .button { display: inline-block; padding: 12px 24px; background: #0d47a1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Help Request</h2>
              <p>You have received a new help request from one of your students.</p>
            </div>
            <div class="content">
              <div class="info-box">
                <div class="label">Student Information</div>
                <div class="value"><strong>${studentName}</strong> (ID: ${studentId})</div>
              </div>
              
              <div class="info-box">
                <div class="label">Category</div>
                <div class="value">${category}</div>
              </div>
              
              <div class="info-box">
                <div class="label">Subject</div>
                <div class="value">${subject}</div>
              </div>
              
              <div class="info-box">
                <div class="label">Urgency</div>
                <div class="value">
                  <span class="urgency ${urgency.toLowerCase()}">${urgency}</span>
                </div>
              </div>
              
              <div class="info-box">
                <div class="label">Details</div>
                <div class="value">${details.replace(/\n/g, '<br>')}</div>
              </div>
              
              <p style="margin-top: 20px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/advisor-dashboard.html" class="button">View in Dashboard</a>
              </p>
              
              <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">
                This is an automated notification from the Horizon State University Student Retention System.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
New Help Request from ${studentName} (Student ID: ${studentId})

Category: ${category}
Subject: ${subject}
Urgency: ${urgency}

Details:
${details}

Please log in to your advisor dashboard to view and respond to this request.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email notification:', error);
    return false;
  }
}

module.exports = {
  sendHelpRequestNotification
};

