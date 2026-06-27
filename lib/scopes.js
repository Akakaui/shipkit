export const SCOPES = {
  web: [
    { name: 'Landing Page', value: 'landing', description: 'Single page, no backend' },
    { name: 'Interactive Frontend', value: 'interactive', description: 'No backend, user interaction' },
    { name: 'Lightweight Web App', value: 'lightweight', description: 'Basic backend, simple features' },
    { name: 'Full-Scale Web App', value: 'full', description: 'Complex backend, multiple features' },
  ],
  mobile: [
    { name: 'Single-screen App', value: 'single', description: 'Landing-like, minimal interaction' },
    { name: 'Multi-screen App', value: 'multi', description: 'Small backend, multiple screens' },
    { name: 'Lightweight App', value: 'lightweight', description: 'Backend integration, moderate features' },
    { name: 'Full-Scale App', value: 'full', description: 'Complex backend, full features' },
  ],
  extension: [
    { name: 'Simple Extension', value: 'simple', description: 'Popup only, minimal background' },
    { name: 'Interactive Extension', value: 'interactive', description: 'Popup + content scripts + API' },
    { name: 'Full-featured Extension', value: 'full', description: 'Background + content + options + API + offline' },
  ],
};