import { Anuphan } from "next/font/google";
import "./globals.css";

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata = {
  title: "เล่นของสูง - บอกระดับความสูงจากน้ำทะเลด้วย OpenStreetMap",
  description: "เครื่องมือเช็กระดับความสูงเหนือระดับน้ำทะเลปานกลาง (MSL) ทั่วประเทศไทย วิเคราะห์พิกัดรัศมี 50 เมตร พร้อมปักหมุดบันทึกข้อมูลและรูปถ่ายลงฐานข้อมูล",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={anuphan.variable}>
      <head>
        {/* Leaflet CSS สำหรับแผนที่ */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
