const nodemailer = require('nodemailer');
const pug = require('pug');
const juice = require('juice');
const htmlToText = require('html-to-text');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      },
      pool: true, // Use connection pool
      maxConnections: 5,
      maxMessages: 100
    });

    this.from = `"EdTech Platform" <${process.env.EMAIL_FROM}>`;
    this.templatesPath = path.join(__dirname, '../templates/email');
  }

  async sendMail(options) {
    const { to, subject, template, data, attachments } = options;

    try {
      // Generate HTML from template
      const html = await this.renderTemplate(template, data);
      
      // Inline CSS
      const inlinedHtml = juice(html);

      // Generate plain text version
      const text = htmlToText.fromString(html, {
        wordwrap: 130,
        ignoreImage: true
      });

      const mailOptions = {
        from: this.from,
        to,
        subject,
        html: inlinedHtml,
        text,
        attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error('Email sending failed:', error);
      throw error;
    }
  }

  async renderTemplate(template, data) {
    const templatePath = path.join(this.templatesPath, `${template}.pug`);
    
    return new Promise((resolve, reject) => {
      pug.renderFile(templatePath, data, (err, html) => {
        if (err) reject(err);
        resolve(html);
      });
    });
  }

  async sendWelcomeEmail(user) {
    const data = {
      firstName: user.firstName,
      loginUrl: `${process.env.BASE_URL}/login`,
      supportEmail: process.env.SUPPORT_EMAIL
    };

    return this.sendMail({
      to: user.email,
      subject: 'Welcome to EdTech Platform! 🎓',
      template: 'welcome',
      data
    });
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.BASE_URL}/reset-password/${resetToken}`;
    
    const data = {
      firstName: user.firstName,
      resetUrl,
      expiryTime: '10 minutes'
    };

    return this.sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      template: 'password-reset',
      data
    });
  }

  async sendCourseCompletionEmail(user, course, certificate) {
    const data = {
      firstName: user.firstName,
      courseName: course.title,
      certificateUrl: certificate.certificateUrl,
      viewCertificateUrl: `${process.env.BASE_URL}/certificates/${certificate._id}`
    };

    return this.sendMail({
      to: user.email,
      subject: `Congratulations! You completed ${course.title} 🎉`,
      template: 'course-completion',
      data,
      attachments: [
        {
          filename: `certificate-${certificate.certificateNumber}.pdf`,
          path: certificate.certificateUrl
        }
      ]
    });
  }

  async sendEnrollmentConfirmation(user, course, payment) {
    const data = {
      firstName: user.firstName,
      courseName: course.title,
      courseUrl: `${process.env.BASE_URL}/courses/${course.slug}`,
      amount: payment?.amount,
      transactionId: payment?.transactionId,
      startLearningUrl: `${process.env.BASE_URL}/courses/${course.slug}/learn`
    };

    return this.sendMail({
      to: user.email,
      subject: `Enrollment Confirmed: ${course.title}`,
      template: 'enrollment-confirmation',
      data
    });
  }

  async sendAnnouncement(user, announcement) {
    const data = {
      firstName: user.firstName,
      title: announcement.title,
      message: announcement.content,
      courseName: announcement.course?.title,
      courseUrl: `${process.env.BASE_URL}/courses/${announcement.course?.slug}`,
      instructorName: announcement.instructor?.name
    };

    return this.sendMail({
      to: user.email,
      subject: announcement.title,
      template: 'announcement',
      data
    });
  }

  async sendPaymentReceipt(user, payment, items) {
    const data = {
      firstName: user.firstName,
      receiptNumber: payment.transactionId,
      date: payment.createdAt,
      items,
      subtotal: payment.amount,
      total: payment.amount,
      paymentMethod: payment.paymentMethod,
      billingAddress: user.address
    };

    return this.sendMail({
      to: user.email,
      subject: `Payment Receipt - ${payment.transactionId}`,
      template: 'payment-receipt',
      data
    });
  }

  async sendInstructorPayout(instructor, amount, period) {
    const data = {
      firstName: instructor.firstName,
      amount,
      period,
      payoutDate: new Date(),
      transactionId: `PO-${Date.now()}`
    };

    return this.sendMail({
      to: instructor.email,
      subject: `Payout Processed: $${amount}`,
      template: 'instructor-payout',
      data
    });
  }

  async sendGradeNotification(user, submission) {
    const data = {
      firstName: user.firstName,
      assignmentName: submission.assignment.title,
      courseName: submission.assignment.course.title,
      grade: submission.grade.percentage,
      points: `${submission.grade.points}/${submission.assignment.totalPoints}`,
      feedback: submission.grade.feedback,
      viewSubmissionUrl: `${process.env.BASE_URL}/assignments/${submission.assignment._id}/submissions`
    };

    return this.sendMail({
      to: user.email,
      subject: `Assignment Graded: ${submission.assignment.title}`,
      template: 'assignment-graded',
      data
    });
  }

  async sendNewsletter(subscribers, content) {
    const batchSize = 50;
    const batches = [];

    for (let i = 0; i < subscribers.length; i += batchSize) {
      batches.push(subscribers.slice(i, i + batchSize));
    }

    const results = {
      sent: 0,
      failed: 0
    };

    for (const batch of batches) {
      const promises = batch.map(subscriber => 
        this.sendMail({
          to: subscriber.email,
          subject: content.subject,
          template: 'newsletter',
          data: {
            firstName: subscriber.firstName,
            content: content.body,
            unsubscribeUrl: `${process.env.BASE_URL}/unsubscribe/${subscriber.unsubscribeToken}`
          }
        }).then(() => results.sent++)
          .catch(() => results.failed++)
      );

      await Promise.all(promises);
      
      // Rate limiting delay
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  async sendVerificationEmail(user, token) {
    const verifyUrl = `${process.env.BASE_URL}/verify-email/${token}`;

    const data = {
      firstName: user.firstName,
      verifyUrl,
      expiryTime: '24 hours'
    };

    return this.sendMail({
      to: user.email,
      subject: 'Verify Your Email Address',
      template: 'email-verification',
      data
    });
  }

  async sendNewDeviceNotification(user, deviceInfo) {
    const data = {
      firstName: user.firstName,
      device: deviceInfo.device,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ip: deviceInfo.ip,
      location: deviceInfo.location,
      time: new Date().toLocaleString(),
      securityUrl: `${process.env.BASE_URL}/account/security`
    };

    return this.sendMail({
      to: user.email,
      subject: 'New Device Login Detected',
      template: 'new-device',
      data
    });
  }

  async sendAccountDeactivationConfirmation(user) {
    const data = {
      firstName: user.firstName,
      reactivateUrl: `${process.env.BASE_URL}/reactivate-account/${user.reactivateToken}`,
      supportEmail: process.env.SUPPORT_EMAIL
    };

    return this.sendMail({
      to: user.email,
      subject: 'Account Deactivation Confirmation',
      template: 'account-deactivated',
      data
    });
  }

  async sendReminderEmail(user, reminder) {
    const data = {
      firstName: user.firstName,
      reminderTitle: reminder.title,
      reminderMessage: reminder.message,
      actionUrl: reminder.actionUrl,
      actionText: reminder.actionText
    };

    return this.sendMail({
      to: user.email,
      subject: reminder.title,
      template: 'reminder',
      data
    });
  }

  async sendBulkEmails(emails) {
    const results = {
      successful: [],
      failed: []
    };

    for (const email of emails) {
      try {
        const result = await this.sendMail(email);
        results.successful.push({ email: email.to, messageId: result.messageId });
      } catch (error) {
        results.failed.push({ email: email.to, error: error.message });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  verifyConnection() {
    return this.transporter.verify();
  }

  async close() {
    await this.transporter.close();
  }
}

module.exports = new EmailService();
// const nodemailer = require('nodemailer');
// const pug = require('pug');
// const htmlToText = require('html-to-text');

// class EmailService {
//   constructor(user, url) {
//     this.to = user.email;
//     this.firstName = user.firstName;
//     this.url = url;
//     this.from = `EdTech Platform <${process.env.EMAIL_FROM}>`;
//   }

//   newTransport() {
//     if (process.env.NODE_ENV === 'production') {
//       // SendGrid
//       return nodemailer.createTransport({
//         service: 'SendGrid',
//         auth: {
//           user: process.env.SENDGRID_USERNAME,
//           pass: process.env.SENDGRID_PASSWORD
//         }
//       });
//     }

//     // Mailtrap for development
//     return nodemailer.createTransport({
//       host: process.env.EMAIL_HOST,
//       port: process.env.EMAIL_PORT,
//       auth: {
//         user: process.env.EMAIL_USERNAME,
//         pass: process.env.EMAIL_PASSWORD
//       }
//     });
//   }

//   async send(template, subject) {
//     // Render HTML based on pug template
//     const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
//       firstName: this.firstName,
//       url: this.url,
//       subject
//     });

//     const mailOptions = {
//       from: this.from,
//       to: this.to,
//       subject,
//       html,
//       text: htmlToText.fromString(html)
//     };

//     await this.newTransport().sendMail(mailOptions);
//   }

//   async sendWelcome() {
//     await this.send('welcome', 'Welcome to EdTech Platform!');
//   }

//   async sendPasswordReset() {
//     await this.send('passwordReset', 'Your password reset token (valid for only 10 minutes)');
//   }

//   async sendCourseCompletion(courseName, certificateUrl) {
//     await this.send('courseCompletion', `Congratulations! You completed ${courseName}`);
//   }
// }

// module.exports = EmailService;