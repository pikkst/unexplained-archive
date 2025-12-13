# Unexplained Archive

A global community platform for documenting and investigating unexplained phenomena - UFOs, extraterrestrial encounters, paranormal events, and mysterious occurrences.

## 🌟 Features

- **User Submissions**: Share encounters with photos, videos, or AI-generated illustrations
- **Interactive World Map**: Explore cases by location with clustering and filters
- **Investigator Network**: Verified experts can claim and investigate cases
- **Community Engagement**: Comments, votes, and reputation system
- **Reward System**: Transparent donations and investigator compensation
- **Admin Moderation**: Dispute resolution and investigator verification

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account (free)
- Hugging Face API key (free)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/unexplained-archive.git
cd unexplained-archive
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup Supabase**
   - Follow instructions in `SUPABASE_SETUP.md`
   - Create project and run SQL schema
   - Setup storage bucket

4. **Configure environment**
```bash
cp .env.example .env
```

Edit `.env` with your keys:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_HUGGING_FACE_API_KEY=your_hf_api_key
```

5. **Start development server**
```bash
npm run dev
```

Visit `http://localhost:3000`

## 📚 Documentation

- **[Supabase Setup](SUPABASE_SETUP.md)** - Database configuration
- **[Deployment Guide](DEPLOYMENT.md)** - GitHub Pages deployment
- **[API Documentation](docs/API.md)** - Backend API reference (coming soon)

## 🏗️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Authentication + Storage)
- **Maps**: Leaflet / React-Leaflet
- **AI**: Hugging Face Inference API
- **Deployment**: GitHub Pages / Vercel / Netlify

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- Input validation and sanitization
- XSS protection with DOMPurify
- Secure authentication with Supabase Auth
- Environment variables for sensitive data

## 📁 Project Structure

```
unexplained-archive/
├── src/
│   ├── components/       # React components
│   ├── contexts/         # Auth and global state
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Supabase client
│   ├── services/        # API services
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── public/              # Static assets
├── .github/workflows/   # CI/CD pipelines
├── supabase-schema.sql  # Database schema
└── README.md
```

## 🎯 Roadmap

- [x] User authentication
- [x] Case submission
- [x] Interactive map
- [x] Investigator system
- [ ] Real-time notifications
- [ ] Mobile app
- [ ] Advanced analytics
- [ ] API for third-party integrations

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

- Icons by [Lucide](https://lucide.dev/)
- Maps by [Leaflet](https://leafletjs.com/)
- AI by [Hugging Face](https://huggingface.co/)
- Backend by [Supabase](https://supabase.com/)

## 📧 Contact

- Website: [https://your-username.github.io/unexplained-archive](https://your-username.github.io/unexplained-archive)
- Email: your-email@example.com
- Twitter: [@YourHandle](https://twitter.com/YourHandle)

---

**Note**: This is a community platform for documenting personal experiences. All cases are user-submitted and not scientifically verified.
