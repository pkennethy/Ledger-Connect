export const CONFIG = {
  SUPABASE: {
    // Replace these with your actual Supabase project details
    // You can find them in Supabase Dashboard → Settings → API
    URL: 'https://uollliznndfsswiqimsz.supabase.co', 
    // The Anon Key provided by the user
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvbGxsaXpubmRmc3N3aXFpbXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMzc5OTEsImV4cCI6MjA3NzgxMzk5MX0.OnKMAv81JtzAFjA4r8SsimlnCFriSnGQGN2zuIncf_o'
  },
  ADSTERRA: {
    ENABLED: true,
    // Desktop Key (468x60)
    KEY: '21f8461d6e540c2d6e7aa1c5d9b0e3d4',
    // Mobile Key (320x50) - Create a new 320x50 unit in Adsterra and paste key here. 
    // If left empty, it will try to use the desktop key (might not load).
    MOBILE_KEY: '' 
  }
};