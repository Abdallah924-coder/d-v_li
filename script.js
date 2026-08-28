const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-button");
const navLinks = document.querySelectorAll(".nav a");
const form = document.querySelector(".contact-form");
const note = document.querySelector(".form-note");

const apiMeta = document.querySelector('meta[name="contact-api-url"]');
const contactApiUrl = apiMeta?.content || "/api/contact";

if (menuButton && header) {
  menuButton.addEventListener("click", () => {
    const isOpen = header.classList.toggle("is-open");
    document.body.classList.toggle("menu-open", isOpen);
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    header?.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    menuButton?.setAttribute("aria-expanded", "false");
  });
});

function setFormNote(message, isError = false) {
  if (!note) return;
  note.textContent = message;
  note.classList.toggle("is-error", isError);
}

if (form && note) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const defaultButtonContent = submitButton.innerHTML;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitButton.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-send"></use></svg>Envoi en cours...';
    setFormNote("");

    try {
      const response = await fetch(contactApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Impossible d'envoyer la demande.");
      }

      setFormNote("Demande envoyee. Je reviens avec une reponse claire sur le cadrage, le budget et le delai.");
      form.reset();
    } catch (error) {
      setFormNote(error.message || "Erreur reseau. Reessayez plus tard.", true);
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitButton.innerHTML = defaultButtonContent;
    }
  });
}

const newsletterForm = document.querySelector(".newsletter-form");
const newsletterNote = document.querySelector(".newsletter-note");

function setNewsletterNote(message, isError = false) {
  if (!newsletterNote) return;
  newsletterNote.textContent = message;
  newsletterNote.classList.toggle("is-error", isError);
}

if (newsletterForm && newsletterNote) {
  newsletterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!newsletterForm.checkValidity()) {
      newsletterForm.reportValidity();
      return;
    }

    const submitButton = newsletterForm.querySelector('button[type="submit"]');
    const defaultButtonContent = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitButton.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-send"></use></svg>Inscription en cours...';
    setNewsletterNote("");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(newsletterForm).entries())),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Inscription impossible.");
      setNewsletterNote("Inscription confirmée. Un email de bienvenue vient de vous être envoyé.");
      newsletterForm.reset();
    } catch (error) {
      setNewsletterNote(error.message || "Erreur réseau. Réessayez plus tard.", true);
    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitButton.innerHTML = defaultButtonContent;
    }
  });
}

const revealItems = document.querySelectorAll(".skill-card, .project-card, .proof-item, .tech-card, .timeline div, .profile-band");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.18 }
);

revealItems.forEach((item) => {
  item.classList.add("reveal");
  observer.observe(item);
});
