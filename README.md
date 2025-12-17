# 🌟 Unexplained Archive

> **⚠️ PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED**  
> **© 2025 Unexplained Archive. This project is protected by copyright law.**  
> **See [LICENSE](LICENSE) and [COPYRIGHT_NOTICE.md](COPYRIGHT_NOTICE.md) for details.**  
> **❌ NOT OPEN SOURCE - No usage, copying, or redistribution permitted.**

---

A global community platform for documenting, investigating, and exploring unexplained phenomena. From UFO sightings and extraterrestrial encounters to paranormal events and mysterious occurrences - share your experiences and connect with verified investigators worldwide.

**🚀 Live**: [https://pikkst.github.io/unexplained-archive/](https://pikkst.github.io/unexplained-archive/)

---

## ✨ Features

### For Users
- 📝 **Submit Cases** - Document your unexplained experiences with photos, videos, and detailed descriptions
- 🗺️ **Interactive Map** - View cases worldwide and explore patterns in mysterious phenomena
- 🔍 **Search & Filter** - Find specific types of cases by category, location, date
- 💬 **Community Discussion** - Comment, discuss, and share theories with other users
- ⭐ **Ratings & Reviews** - Rate cases and investigators based on credibility

### For Investigators
- 📊 **Investigation Tools** - AI-powered analysis of case descriptions and images
- 👥 **Team Collaboration** - Form teams, invite colleagues, share investigations
- 💰 **Bounty System** - Earn rewards for resolving cases or providing valuable insights
- 📈 **Profile & Reputation** - Build your investigation track record
- 🎖️ **Verification System** - Become a verified investigator and gain community trust

### For Developers
- 🔗 **API Access** - RESTful API for third-party integrations
- 📚 **Webhooks** - Real-time case updates and notifications
-  **Secure Backend** - Supabase PostgreSQL with Row Level Security

---

## 🚀 Quick Start

> **⚠️ NOTICE**: This section is for educational/viewing purposes only.  
> **You may NOT deploy, use, or run this software for any purpose.**  
> **See [COPYRIGHT_NOTICE.md](COPYRIGHT_NOTICE.md) for full details.**

### Prerequisites
- Node.js 18+ and npm
- Supabase account (free tier available)
- Stripe account (for payments - optional)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/pikkst/unexplained-archive.git
cd unexplained-archive
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
```

Edit `.env` with your keys (see [.env.example](.env.example)):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key
VITE_GEMINI_API_KEY=your_gemini_key
```

4. **Start development server**
```bash
npm run dev
```

Visit `http://localhost:5173`

5. **Build for production**
```bash
npm run build
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [Supabase Setup](Docks/SUPABASE_SETUP.md) | Database configuration & initialization |
| [Deployment Guide](Docks/DEPLOYMENT.md) | GitHub Pages & CI/CD setup |
| [Getting Started](Docks/GETTING_STARTED.md) | Complete setup walkthrough |
| [Team Collaboration](Docks/TEAM_COLLABORATION_DOCS.md) | Team system documentation |
| [API Reference](Docks/API.md) | Backend API endpoints (coming soon) |

---

## 🏗️ Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Zustand** - State management
- **TanStack Query** - Data fetching

### Backend
- **Supabase** - PostgreSQL database + Auth + Storage
- **Edge Functions** - Deno-based serverless functions
- **Stripe** - Payment processing
- **Resend** - Email service
- **Google Gemini** - AI image/text analysis

### Infrastructure
- **GitHub Pages** - Static hosting
- **GitHub Actions** - CI/CD pipeline
- **Vite** - Build tool

---

## 🔐 Security

- ✅ **Row Level Security (RLS)** - Database-level access control
- ✅ **Input Validation** - Zod schema validation
- ✅ **XSS Protection** - DOMPurify sanitization
- ✅ **CSRF Protection** - Secure token handling
- ✅ **Environment Secrets** - Sensitive data in Supabase secrets
- ✅ **HTTPS Only** - GitHub Pages & Supabase encrypted
- ✅ **API Rate Limiting** - Edge function rate limits

---

## 📊 Project Status

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend | ✅ Production | React 19, all pages live |
| Database | ✅ Production | Supabase PostgreSQL, 36 tables |
| Authentication | ✅ Production | Supabase Auth, email verification |
| Payments | ✅ Live | Stripe production mode active |
| Email | ✅ Live | Resend email service configured |
| AI Tools | ✅ Live | Gemini 2.0 Flash with rate limiting |
| Deployment | ✅ Live | GitHub Pages + GitHub Actions |
| Webhooks | ✅ Live | Stripe webhooks registered |

---

## 🚀 Deployment

### Automatic Deployment
Every push to `main` branch triggers GitHub Actions:
1. Build optimizations
2. Production bundle (~400KB gzip)
3. Automated deployment to GitHub Pages
4. Live in ~2 minutes

### Manual Deployment
```bash
npm run build        # Create dist/
git add .
git commit -m "Deploy production build"
git push origin main  # Triggers GitHub Actions
```

---

## 💰 Payment System

### Stripe Integration (LIVE MODE)
- Publishable Key: `pk_live_...` ✅
- Secret Key: In Supabase secrets ✅
- Webhooks: `memorable-sensation` endpoint ✅
- Rate Limiting: Yes, monitored

### Payment Types
- Case Bounties: Investigators earn rewards
- Team Payouts: Automated distribution
- Escrow System: Secure payment holding
- Subscription Plans: Premium features

---

## 📧 Email Service

### Resend Configuration
- API Key: In Supabase secrets ✅
- From Email: `onboarding@resend.dev`
- Domain: Resend default
- Status: All systems operational

### Email Templates
- Welcome emails
- Case notifications
- Payment confirmations
- Team invitations
- Report summaries

---

## 🔧 Troubleshooting

### Build Issues
```bash
npm run build       # Check for errors
npm cache clean --force
npm install        # Reinstall dependencies
```

### Database Connection
- Check Supabase project status
- Verify API keys in `.env`
- Check RLS policies are enabled
- Review Supabase logs

### Deployment Issues
- GitHub Actions logs: Settings → Actions
- Build output: Check `npm run build`
- GitHub Pages: Settings → Pages
- DNS: Check CNAME file exists

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

- **Frontend**: React, Tailwind CSS, Lucide Icons
- **Maps**: Leaflet & React-Leaflet
- **Backend**: Supabase, PostgreSQL
- **Payments**: Stripe
- **Email**: Resend
- **AI**: Google Gemini
- **Deployment**: GitHub

---

## � License & Copyright

**© 2025 Unexplained Archive. All Rights Reserved.**

This project is **PROPRIETARY SOFTWARE** and is **NOT OPEN SOURCE**.

- ❌ **No Usage Rights** - You may not use this code for any purpose
- ❌ **No Copying** - You may not copy or redistribute this code
- ❌ **No Derivatives** - You may not create similar projects based on this
- ❌ **No Commercial Use** - Strictly prohibited
- ✅ **View Only** - You may view the code for educational purposes

**Full Legal Details:**
- [LICENSE](LICENSE) - Complete legal terms
- [COPYRIGHT_NOTICE.md](COPYRIGHT_NOTICE.md) - Detailed protection notice

**Violation of this copyright will result in legal action.**

---

## �📊 Statistics

- **Platform Age**: Production (Dec 2024)
- **Total Users**: Actively growing
- **Cases Submitted**: 100+
- **Verified Investigators**: Growing community
- **Performance**: 99.9% uptime

---

## 📞 Support & Contact

| Channel | Contact |
|---------|---------|
| Email | huntersest@gmail.com |
| GitHub | [github.com/pikkst/unexplained-archive](https://github.com/pikkst/unexplained-archive) |
| Website | [pikkst.github.io/unexplained-archive](https://pikkst.github.io/unexplained-archive) |
| Issues | [GitHub Issues](https://github.com/pikkst/unexplained-archive/issues) |

---

## 🎯 Roadmap

### ✅ Completed
- User authentication & profiles
- Case submission & storage
- Interactive map
- Investigator system
- Payment processing (Stripe)
- Email notifications
- AI image analysis
- Team collaboration
- Database cleanup

### 🚀 Planned
- Mobile app (React Native)
- Advanced analytics dashboard
- API documentation portal
- Third-party integrations
- Real-time collaboration tools
- Machine learning case clustering

---

## ⚖️ Legal & Disclaimer

**PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED**

This software is the exclusive property of its copyright holder. Any unauthorized use, copying, modification, distribution, or deployment is strictly prohibited and will result in legal action.

For licensing inquiries: huntersest@gmail.com

---

**Built with 🔬 for the unexplained research community**
- Public API with rate limiting

---

**Last Updated**: December 13, 2025  
**Status**: 🟢 Production Ready  
**Version**: 1.0  

**Join us in documenting the unexplained! 🌍👽**
