# Portfolio + Backend contact Brevo

Un seul Web Service Render sert le portfolio statique et l'API de contact.

- Frontend: `index.html`, `styles.css`, `script.js`, images, servis par Express.
- Backend: `POST /api/contact` et `POST /api/newsletter`, envoi email via l'API HTTP Brevo.
- Health check: `GET /health`.

## Variables Render

Configurer ces variables dans le Web Service Render:

- `BREVO_API_KEY`: cle API Brevo transactionnelle.
- `BREVO_SENDER_EMAIL`: expediteur verifie dans Brevo.
- `BREVO_SENDER_NAME`: nom expediteur.
- `CONTACT_TO_EMAIL`: email qui recoit les demandes.
- `CONTACT_TO_NAME`: nom du destinataire.
- `NEWSLETTER_LIST_ID`: identifiant de la liste Brevo qui reçoit les abonnés.
- `CONTACT_SUBJECT_PREFIX`: optionnel, par defaut `[Portfolio]`.

## Render Web Service unique

Depuis la racine du projet:

- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

Le fichier `render.yaml` est deja configure pour un seul service Node.

## Frontend

La meta suivante doit rester comme ceci pour le meme service:

```html
<meta name="contact-api-url" content="/api/contact">
```

Ne mets jamais `BREVO_API_KEY` dans le frontend.
