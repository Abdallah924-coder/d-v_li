import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import validator from 'validator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = Number(process.env.PORT || 10000);
const projectRoot = path.resolve(__dirname, '..');
const isProduction = process.env.NODE_ENV === 'production';

const requiredEnv = [
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
  'CONTACT_TO_EMAIL',
];

const newsletterEnv = ['BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'NEWSLETTER_LIST_ID'];

const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  console.warn(`Missing environment variables: ${missingEnv.join(', ')}`);
}

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc: ['https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Trop de demandes. Reessayez dans quelques minutes.' },
});

function isSameOrigin(request) {
  const origin = request.get('origin');
  if (!origin) return true;

  const forwardedProto = request.get('x-forwarded-proto')?.split(',')[0].trim();
  const protocol = forwardedProto || request.protocol;
  return origin === `${protocol}://${request.get('host')}`;
}

function cleanText(value, maxLength) {
  return validator.escape(String(value || '').trim().slice(0, maxLength));
}

function validateContactPayload(body) {
  const rawName = String(body.name || '').trim();
  const rawEmail = String(body.email || '').trim();
  const rawProjectType = String(body.project_type || '').trim();
  const rawBudget = String(body.budget || '').trim();
  const rawMessage = String(body.message || '').trim();
  const honeypot = String(body.website || '').trim();

  const errors = [];
  if (honeypot) errors.push('Invalid submission.');
  if (!validator.isLength(rawName, { min: 2, max: 80 })) errors.push('Nom invalide.');
  if (!validator.isEmail(rawEmail) || rawEmail.length > 120) errors.push('Email invalide.');
  if (!validator.isLength(rawProjectType, { min: 2, max: 80 })) errors.push('Type de projet invalide.');
  if (!validator.isLength(rawBudget, { min: 2, max: 80 })) errors.push('Budget invalide.');
  if (!validator.isLength(rawMessage, { min: 20, max: 2000 })) errors.push('Message trop court ou trop long.');

  return {
    errors,
    data: {
      name: cleanText(rawName, 80),
      email: validator.normalizeEmail(rawEmail) || rawEmail,
      projectType: cleanText(rawProjectType, 80),
      budget: cleanText(rawBudget, 80),
      message: cleanText(rawMessage, 2000),
    },
  };
}

function emailLayout(title, eyebrow, content) {
  return `
    <html>
      <body style="margin:0;background:#08110f;color:#f5f7f2;font-family:Arial,sans-serif;line-height:1.6">
        <div style="max-width:640px;margin:0 auto;padding:36px 20px">
          <div style="border:1px solid #29453a;background:#0e1c18;padding:32px">
            <p style="margin:0 0 18px;color:#47e7a4;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${eyebrow}</p>
            <h1 style="margin:0 0 22px;color:#f2c66d;font-family:Georgia,serif;font-size:34px;font-weight:400;line-height:1.1">${title}</h1>
            ${content}
            <div style="margin-top:30px;padding-top:18px;border-top:1px solid #29453a;color:#9bb0a6;font-size:13px">
              D€V L\\ · Produit WorldifyAI by Devoue
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildAdminEmailHtml(data) {
  return emailLayout('Nouvelle demande de projet', 'Portfolio · Contact', `
    <p style="color:#dbe5df">Une nouvelle demande vient d’arriver depuis le portfolio.</p>
    <table style="width:100%;border-collapse:collapse;margin:24px 0;color:#dbe5df">
      <tr><td style="padding:10px 0;color:#9bb0a6">Nom</td><td style="padding:10px 0">${data.name}</td></tr>
      <tr><td style="padding:10px 0;color:#9bb0a6">Email</td><td style="padding:10px 0">${data.email}</td></tr>
      <tr><td style="padding:10px 0;color:#9bb0a6">Projet</td><td style="padding:10px 0">${data.projectType}</td></tr>
      <tr><td style="padding:10px 0;color:#9bb0a6">Budget</td><td style="padding:10px 0">${data.budget}</td></tr>
    </table>
    <div style="border-left:3px solid #47e7a4;padding:12px 16px;background:#132720;color:#dbe5df">${data.message.replace(/\n/g, '<br>')}</div>
  `);
}

function buildConfirmationEmailHtml(data) {
  return emailLayout('Merci pour votre demande', 'D€V L\\ · Confirmation', `
    <p style="color:#dbe5df">Bonjour ${data.name},</p>
    <p style="color:#dbe5df">Votre demande a bien été reçue. Je vais l’étudier et revenir vers vous avec une réponse claire sur le cadrage, le budget et le délai.</p>
    <div style="margin:24px 0;padding:16px;background:#132720;color:#dbe5df"><strong style="color:#f2c66d">Votre projet :</strong> ${data.projectType}<br><strong style="color:#f2c66d">Budget estimé :</strong> ${data.budget}</div>
    <p style="color:#9bb0a6">Vous pouvez répondre directement à cet email si vous souhaitez ajouter une précision.</p>
  `);
}

function buildNewsletterEmailHtml(email) {
  return emailLayout('Bienvenue dans la newsletter', 'D€V L\\ · WorldifyAI', `
    <p style="color:#dbe5df">Merci pour votre inscription.</p>
    <p style="color:#dbe5df">Vous recevrez des nouvelles utiles autour des produits numériques, du développement web et de l’intelligence artificielle.</p>
    <p style="color:#9bb0a6">Cette adresse est maintenant inscrite : ${email}</p>
  `);
}

function brevoHeaders() {
  return {
    accept: 'application/json',
    'api-key': process.env.BREVO_API_KEY,
    'content-type': 'application/json',
  };
}

async function sendBrevoEmail(payload) {
  const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: brevoHeaders(),
    body: JSON.stringify(payload),
  });
  const result = await brevoResponse.json().catch(() => ({}));
  if (!brevoResponse.ok) {
    console.error('Brevo email error', brevoResponse.status, result);
    throw new Error('Brevo email error');
  }
  return result;
}

async function addNewsletterContact(email) {
  const response = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: brevoHeaders(),
    body: JSON.stringify({
      email,
      listIds: [Number(process.env.NEWSLETTER_LIST_ID)],
      updateEnabled: true,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Brevo contact error', response.status, result);
    throw new Error('Brevo contact error');
  }
  return result;
}

app.get('/health', (_request, response) => {
  response.status(200).json({ ok: true });
});

app.post('/api/contact', contactLimiter, async (request, response) => {
  if (!isSameOrigin(request)) {
    return response.status(403).json({ message: 'Origine non autorisee.' });
  }

  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    return response.status(500).json({ message: 'Configuration email incomplete.' });
  }

  const { errors, data } = validateContactPayload(request.body || {});
  if (errors.length > 0) {
    return response.status(400).json({ message: errors[0] });
  }

  const sender = {
    email: process.env.BREVO_SENDER_EMAIL,
    name: process.env.BREVO_SENDER_NAME || 'D€V L\\ · WorldifyAI',
  };
  const subjectPrefix = process.env.CONTACT_SUBJECT_PREFIX || '[Portfolio]';

  try {
    await sendBrevoEmail({
      sender,
      to: [{ email: process.env.CONTACT_TO_EMAIL, name: process.env.CONTACT_TO_NAME || 'Contact' }],
      replyTo: { email: data.email, name: data.name },
      subject: `${subjectPrefix} ${data.projectType} - ${data.name}`,
      htmlContent: buildAdminEmailHtml(data),
      tags: ['portfolio-contact'],
    });

    try {
      await sendBrevoEmail({
        sender,
        to: [{ email: data.email, name: data.name }],
        replyTo: { email: process.env.BREVO_SENDER_EMAIL, name: sender.name },
        subject: 'Votre demande a bien ete envoyee',
        htmlContent: buildConfirmationEmailHtml(data),
        tags: ['portfolio-confirmation'],
      });
    } catch (confirmationError) {
      console.error('Confirmation email error', confirmationError);
    }

    return response.status(201).json({ ok: true });
  } catch (error) {
    console.error('Contact email error', error);
    return response.status(502).json({ message: 'Service email indisponible.' });
  }
});

const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Trop de tentatives. Reessayez plus tard.' },
});

app.post('/api/newsletter', newsletterLimiter, async (request, response) => {
  if (!isSameOrigin(request)) {
    return response.status(403).json({ message: 'Origine non autorisee.' });
  }

  const email = String(request.body?.email || '').trim();
  const missing = newsletterEnv.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    return response.status(500).json({ message: 'Configuration newsletter incomplete.' });
  }
  if (!validator.isEmail(email) || email.length > 120) {
    return response.status(400).json({ message: 'Email invalide.' });
  }

  const normalizedEmail = validator.normalizeEmail(email) || email;
  try {
    await addNewsletterContact(normalizedEmail);
    await sendBrevoEmail({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: process.env.BREVO_SENDER_NAME || 'D€V L\\ · WorldifyAI',
      },
      to: [{ email: normalizedEmail }],
      subject: 'Bienvenue dans la newsletter D€V L\\',
      htmlContent: buildNewsletterEmailHtml(normalizedEmail),
      tags: ['newsletter-welcome'],
    });
    return response.status(201).json({ ok: true });
  } catch (error) {
    console.error('Newsletter error', error);
    return response.status(502).json({ message: 'Inscription newsletter indisponible.' });
  }
});

const publicFiles = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/styles.css', 'styles.css'],
  ['/script.js', 'script.js'],
  ['/image1.png', 'image1.png'],
  ['/image2.png', 'image2.png'],
]);

app.get([...publicFiles.keys()], (request, response) => {
  const fileName = publicFiles.get(request.path);
  if (fileName === 'index.html') {
    response.setHeader('Cache-Control', 'no-store');
  } else {
    response.setHeader('Cache-Control', isProduction ? 'public, max-age=3600' : 'no-store');
  }
  return response.sendFile(path.join(projectRoot, fileName));
});

app.use((_request, response) => {
  response.status(404).json({ message: 'Not found' });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  return response.status(500).json({ message: 'Erreur serveur.' });
});

app.listen(port, () => {
  console.log(`Contact backend listening on port ${port}`);
});
