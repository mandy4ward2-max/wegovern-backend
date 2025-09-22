const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Email configuration
const createTransporter = () => {
  // You can configure this for different email providers
  // Gmail example (requires app password)
  return nodemailer.createTransport({
    service: 'gmail', // or 'outlook', 'yahoo', etc.
    auth: {
      user: process.env.EMAIL_USER || '', // Your email
      pass: process.env.EMAIL_PASSWORD || '' // App password (not regular password)
    }
  });

  // Alternative: SMTP configuration
  /*
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  */
};

// Email templates
const emailTemplates = {
  newMotion: (motion, orgName, tasks = []) => ({
    subject: `There is a New Motion to Vote On!`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <!-- Logo Header -->
        <div style="background: #ffffff; padding: 30px 30px 20px 30px; border-radius: 10px 10px 0 0; text-align: center; border-bottom: 1px solid #e0e0e0;">
          <img src="${process.env.BACKEND_URL || 'http://localhost:3000'}/public/white-logo.png" alt="WEGovern Logo" style="max-width: 150px; height: auto; margin-bottom: 15px;" />
          <h2 style="margin: 0; font-size: 20px; font-weight: bold; color: #333; text-align: center;">${orgName}</h2>
        </div>
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1565c0;">🗳️ New Motion to Vote On!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Action Required</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          <!-- Motion Details -->
          <div style="background-color: #f8f9fa; border-left: 4px solid #1976d2; padding: 20px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
            <h2 style="margin: 0 0 15px 0; color: #1976d2; font-size: 20px;">${motion.title}</h2>
            <div style="margin-bottom: 15px;">
              <strong style="color: #555;">Posted By:</strong> 
              <span style="color: #333;">${motion.User ? `${motion.User.firstName} ${motion.User.lastName}` : 'Unknown'}</span>
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #555;">Status:</strong> 
              <span style="display: inline-block; background-color: #e3f2fd; color: #1976d2; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">${motion.status}</span>
            </div>
          </div>
          
          <!-- Motion Text -->
          <div style="margin-bottom: 25px;">
            <h3 style="color: #333; font-size: 16px; margin-bottom: 10px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">📋 Motion Details</h3>
            <div style="background-color: #ffffff; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px; line-height: 1.6;">
              ${motion.motion}
            </div>
          </div>
          
          ${motion.description ? `
          <!-- Description -->
          <div style="margin-bottom: 25px;">
            <h3 style="color: #333; font-size: 16px; margin-bottom: 10px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">📄 Description</h3>
            <div style="background-color: #f8f9fa; border: 1px solid #e0e0e0; padding: 15px; border-radius: 8px; color: #555; line-height: 1.5;">
              ${motion.description}
            </div>
          </div>
          ` : ''}
          
          ${tasks && tasks.length > 0 ? `
          <!-- Tasks -->
          <div style="margin-bottom: 25px;">
            <h3 style="color: #333; font-size: 16px; margin-bottom: 15px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">✅ Associated Tasks</h3>
            <div style="background-color: #f8f9fa; border: 1px solid #e0e0e0; padding: 15px; border-radius: 8px;">
              ${tasks.map((task, index) => `
                <div style="display: flex; align-items: flex-start; margin-bottom: ${index < tasks.length - 1 ? '15px' : '0'}; padding-bottom: ${index < tasks.length - 1 ? '15px' : '0'}; ${index < tasks.length - 1 ? 'border-bottom: 1px solid #e0e0e0;' : ''}">
                  <div style="background-color: #1976d2; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; margin-right: 12px; flex-shrink: 0;">${index + 1}</div>
                  <div style="flex-grow: 1;">
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${task.action}</div>
                    ${task.user ? `<div style="font-size: 13px; color: #666;">Assigned to: ${task.user.firstName} ${task.user.lastName}</div>` : ''}
                    ${task.due ? `<div style="font-size: 13px; color: #666;">Due: ${new Date(task.due).toLocaleDateString()}</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          <!-- Call to Action -->
          <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 1px solid #e0e0e0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/motion/${motion.id}" 
               style="display: inline-block; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: #1565c0; text-decoration: none; padding: 15px 30px; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(25,118,210,0.3); transition: all 0.3s ease;">
              🗳️ View Motion & Cast Your Vote
            </a>
            <p style="margin: 15px 0 0 0; color: #666; font-size: 14px;">
              Click the button above to review the full motion details and cast your vote.
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="margin: 0; color: #666; font-size: 13px;">
            This notification was sent by your WEGovern system for <strong>${orgName}</strong>
          </p>
          <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">
            If you're having trouble with the button above, copy and paste this URL into your browser:<br>
            ${process.env.FRONTEND_URL || 'http://localhost:3001'}/motion/${motion.id}
          </p>
        </div>
      </div>
    `
  }),

  newComment: (comment, motion, orgName) => ({
    subject: `New Comment on: ${motion.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">New Comment Posted</h2>
        <p><strong>Organization:</strong> ${orgName}</p>
        <p><strong>Motion:</strong> ${motion.title}</p>
        <p><strong>Comment by:</strong> ${comment.username}</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
          "${comment.text}"
        </div>
        <hr>
        <p>Please log in to your WEGovern account to view the full discussion.</p>
      </div>
    `
  }),

  newVote: (vote, motion, orgName, votesCounts) => ({
    subject: `New Vote on: ${motion.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">New Vote Cast</h2>
        <p><strong>Organization:</strong> ${orgName}</p>
        <p><strong>Motion:</strong> ${motion.title}</p>
        <p><strong>Voter:</strong> ${vote.user.name}</p>
        <p><strong>Vote:</strong> <span style="color: ${vote.voteType === 'for' ? '#28a745' : '#dc3545'}; font-weight: bold;">${vote.voteType.toUpperCase()}</span></p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
          <p><strong>Current Vote Count:</strong></p>
          <p>For: ${votesCounts.for} | Against: ${votesCounts.against}</p>
        </div>
        <hr>
        <p>Please log in to your WEGovern account to view the motion details.</p>
      </div>
    `
  }),

  motionStatusChange: (motion, orgName, newStatus, votesFor, votesAgainst) => ({
    subject: `A motion has been ${newStatus.toLowerCase()}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); padding: 30px; text-align: center; position: relative;">
          <img src="${process.env.BACKEND_URL || 'http://localhost:3000'}/public/white-logo.png" 
               alt="WEGovern Logo" 
               style="height: 50px; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            Motion has been ${newStatus}
          </h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
            ${orgName}
          </p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          
          <!-- Motion Details -->
          <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <h2 style="color: #333; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">📋 ${motion.title}</h2>
            <div style="color: #555; font-size: 15px; line-height: 1.6; margin-bottom: 15px;">
              ${motion.motion}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
              <span style="display: inline-block; background-color: ${newStatus === 'Passed' ? '#d4edda' : '#f8d7da'}; color: ${newStatus === 'Passed' ? '#155724' : '#721c24'}; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; text-transform: uppercase;">
                ${newStatus}
              </span>
              <span style="color: #666; font-size: 13px;">
                ${new Date(motion.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          <!-- Vote Tally -->
          <div style="margin-bottom: 25px;">
            <h3 style="color: #333; font-size: 18px; margin-bottom: 20px; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px;">🗳️ Vote Results</h3>
            
            <!-- Votes Summary -->
            <div style="display: flex; gap: 15px; margin-bottom: 20px;">
              <div style="flex: 1; background-color: #d4edda; border: 2px solid #c3e6cb; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #155724; margin-bottom: 5px;">${(votesFor && votesFor.length) || 0}</div>
                <div style="font-size: 14px; color: #155724; font-weight: 600;">Votes For</div>
              </div>
              <div style="flex: 1; background-color: #f8d7da; border: 2px solid #f5c6cb; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: #721c24; margin-bottom: 5px;">${(votesAgainst && votesAgainst.length) || 0}</div>
                <div style="font-size: 14px; color: #721c24; font-weight: 600;">Votes Against</div>
              </div>
            </div>
            
            <!-- Detailed Vote Lists -->
            <div style="display: flex; gap: 15px;">
              <!-- Votes For -->
              <div style="flex: 1;">
                <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; border-radius: 6px;">
                  <h4 style="margin: 0 0 10px 0; color: #28a745; font-size: 14px; font-weight: 600;">✅ Voted For:</h4>
                  ${(votesFor && votesFor.length > 0) ? `
                    <ul style="margin: 0; padding-left: 20px; color: #555;">
                      ${votesFor.map(vote => `
                        <li style="margin-bottom: 5px; font-size: 14px;">${vote.user.firstName} ${vote.user.lastName}</li>
                      `).join('')}
                    </ul>
                  ` : `
                    <p style="margin: 0; color: #666; font-size: 13px; font-style: italic;">No votes for this motion</p>
                  `}
                </div>
              </div>
              
              <!-- Votes Against -->
              <div style="flex: 1;">
                <div style="background-color: #f8f9fa; border-left: 4px solid #dc3545; padding: 15px; border-radius: 6px;">
                  <h4 style="margin: 0 0 10px 0; color: #dc3545; font-size: 14px; font-weight: 600;">❌ Voted Against:</h4>
                  ${(votesAgainst && votesAgainst.length > 0) ? `
                    <ul style="margin: 0; padding-left: 20px; color: #555;">
                      ${votesAgainst.map(vote => `
                        <li style="margin-bottom: 5px; font-size: 14px;">${vote.user.firstName} ${vote.user.lastName}</li>
                      `).join('')}
                    </ul>
                  ` : `
                    <p style="margin: 0; color: #666; font-size: 13px; font-style: italic;">No votes against this motion</p>
                  `}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Call to Action -->
          <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 1px solid #e0e0e0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/motion/${motion.id}" 
               style="display: inline-block; background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(25,118,210,0.3); transition: all 0.3s ease;">
              📄 View Full Motion Details
            </a>
            <p style="margin: 15px 0 0 0; color: #666; font-size: 14px;">
              Click the button above to view the complete motion details and results.
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="margin: 0; color: #666; font-size: 13px;">
            This notification was sent by your WEGovern system for <strong>${orgName}</strong>
          </p>
          <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">
            If you're having trouble with the button above, copy and paste this URL into your browser:<br>
            ${process.env.FRONTEND_URL || 'http://localhost:3001'}/motion/${motion.id}
          </p>
        </div>
      </div>
    `
  })
};

// Core notification functions
const sendEmail = async (to, subject, html) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@wegovern.com',
      to,
      subject,
      html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

const getOrgUsers = async (orgId, excludeUserId = null) => {
  const users = await prisma.user.findMany({
    where: {
      orgId: Number(orgId),
      role: { not: 'Deleted' },
      ...(excludeUserId && { id: { not: Number(excludeUserId) } })
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true
    }
  });

  return users.map(user => ({
    ...user,
    name: `${user.firstName} ${user.lastName}`.trim()
  }));
};

// Notification triggers
const notifyNewMotion = async (motionId) => {
  try {
    const motion = await prisma.motion.findUnique({
      where: { id: Number(motionId) },
      include: {
        org: true,
        User: true, // Changed from submittedBy to User
        tasks: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!motion) return;

    const users = await getOrgUsers(motion.orgId, motion.userId); // Changed from submittedById to userId
    const template = emailTemplates.newMotion(motion, motion.org.name, motion.tasks);

    for (const user of users) {
      await sendEmail(user.email, template.subject, template.html);
    }
  } catch (error) {
    console.error('Failed to send new motion notifications:', error);
  }
};

const notifyNewComment = async (commentId) => {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: Number(commentId) },
      include: {
        motion: {
          include: { org: true }
        },
        user: true
      }
    });

    if (!comment || comment.isDeleted) return;

    const users = await getOrgUsers(comment.motion.orgId, comment.userId);
    const commentData = {
      ...comment,
      username: `${comment.user.firstName} ${comment.user.lastName}`.trim()
    };

    const template = emailTemplates.newComment(commentData, comment.motion, comment.motion.org.name);

    for (const user of users) {
      await sendEmail(user.email, template.subject, template.html);
    }
  } catch (error) {
    console.error('Failed to send new comment notifications:', error);
  }
};

const notifyNewVote = async (voteId) => {
  // DISABLED: New vote notifications are turned off
  return;
};

const notifyMotionStatusChange = async (motionId, newStatus) => {
  try {
    const motion = await prisma.motion.findUnique({
      where: { id: Number(motionId) },
      include: { 
        org: true,
        votes: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!motion) return;

    // Group votes by type
    const votesFor = motion.votes.filter(vote => vote.voteType === 'For');
    const votesAgainst = motion.votes.filter(vote => vote.voteType === 'Against');

    const users = await getOrgUsers(motion.orgId);
    const template = emailTemplates.motionStatusChange(motion, motion.org.name, newStatus, votesFor, votesAgainst);

    for (const user of users) {
      await sendEmail(user.email, template.subject, template.html);
    }
  } catch (error) {
    console.error('Failed to send motion status change notifications:', error);
  }
};

// API endpoints
const sendTestEmail = async (req, res) => {
  try {
    const { email, subject, message } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const testSubject = subject || 'Test Email from WEGovern';
    const testMessage = message || 'This is a test email from your WEGovern notification system.';

    const result = await sendEmail(email, testSubject, `<p>${testMessage}</p>`);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test email sent successfully!', 
        messageId: result.messageId 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error || 'Failed to send test email'
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send test email'
    });
  }
};

module.exports = {
  sendEmail,
  notifyNewMotion,
  notifyNewComment,
  notifyNewVote,
  notifyMotionStatusChange,
  sendTestEmail
};