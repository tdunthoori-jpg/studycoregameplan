import './globals.css';

export const metadata = {
  title: 'StudyCore Game Plan Generator',
  description: 'Generate personalized SAT prep game plans and meeting scripts',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
