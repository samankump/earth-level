'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

// โหลดคอมโพเนนต์แผนที่แบบ Dynamic Client-Side เท่านั้น เพื่อป้องกันปัญหา SSR กับ Leaflet
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%',
      height: '380px',
      borderRadius: '16px',
      backgroundColor: 'var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-muted)'
    }}>
      <div className="spinner" style={{ marginRight: '8px' }}></div>
      กำลังโหลดระบบแผนที่พิกัดดาวเทียม...
    </div>
  )
});

export default function Home() {
  // พิกัดปัจจุบัน (ค่าเริ่มต้นคือพิกัดใจกลางกรุงเทพฯ)
  const [lat, setLat] = useState(13.7563);
  const [lng, setLng] = useState(100.5018);
  const [zoom, setZoom] = useState(12);

  // ข้อมูลระดับความสูง
  const [elevation, setElevation] = useState(null);
  const [radiusData, setRadiusData] = useState(null);
  const [loadingElevation, setLoadingElevation] = useState(false);
  const [elevationError, setElevationError] = useState('');

  // ค้นหาสถานที่
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // ฟอร์มบันทึกข้อมูล
  const SURVEY_FEE = 50.00; // ค่าธรรมเนียมบริการสำรวจและบันทึกข้อมูล (บาท)
  const [locationName, setLocationName] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageBase64, setImageBase64] = useState('');
  const [saving, setSaving] = useState(false);

  // ข้อมูลหมุดที่บันทึกไว้ในระบบ
  const [savedPins, setSavedPins] = useState([]);
  const [loadingPins, setLoadingPins] = useState(true);

  // ดึงรายการหมุดที่บันทึกไว้เมื่อโหลดแอปครั้งแรก
  const fetchSavedPins = async () => {
    setLoadingPins(true);
    try {
      const response = await fetch('/api/pins');
      if (response.ok) {
        const data = await response.json();
        setSavedPins(data);
      }
    } catch (error) {
      console.error('ไม่สามารถโหลดข้อมูลหมุดได้:', error);
    } finally {
      setLoadingPins(false);
    }
  };

  useEffect(() => {
    fetchSavedPins();
  }, []);

  // ดึงระดับความสูงจาก Open-Meteo Elevation API (รวม 10 ม. รอบข้าง)
  const fetchElevationData = useCallback(async (currentLat, currentLng) => {
    setLoadingElevation(true);
    setElevationError('');
    try {
      // ดึงข้อมูลผ่านระบบ Proxy API หลังบ้านเพื่อหลีกเลี่ยง CORS และปัญหาการบล็อก
      const url = `/api/elevation?lat=${currentLat}&lng=${currentLng}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'ไม่สามารถดึงระดับความสูงได้');
      }

      const data = await response.json();
      if (data && data.center !== undefined) {
        setElevation(data.center);
        setRadiusData({
          center: data.center,
          north: data.north,
          south: data.south,
          east: data.east,
          west: data.west
        });
      } else {
        throw new Error('โครงสร้างข้อมูลความสูงจากระบบประมวลผลไม่สมบูรณ์');
      }
    } catch (error) {
      setElevationError('เกิดข้อผิดพลาดในการดึงความสูง: ' + error.message);
      setElevation(null);
      setRadiusData(null);
    } finally {
      setLoadingElevation(false);
    }
  }, []);

  // ดึงข้อมูลระดับความสูงเมื่อพิกัดเปลี่ยน
  useEffect(() => {
    fetchElevationData(lat, lng);
  }, [lat, lng, fetchElevationData]);

  // ฟังก์ชันรองรับการคลิกแผนที่หรือดึงข้อมูลผ่านการลาก
  const handleMapClick = (newLat, newLng) => {
    setLat(newLat);
    setLng(newLng);
  };

  // ป้อนพิกัดละติจูด/ลองจิจูดด้วยมือ
  const handleManualCoordsSubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const inputLat = parseFloat(form.manualLat.value);
    const inputLng = parseFloat(form.manualLng.value);

    if (!isNaN(inputLat) && !isNaN(inputLng)) {
      if (inputLat >= -90 && inputLat <= 90 && inputLng >= -180 && inputLng <= 180) {
        setLat(inputLat);
        setLng(inputLng);
        setZoom(14);
      } else {
        alert('กรุณาป้อนพิกัดให้ถูกต้อง (ละติจูด -90 ถึง 90, ลองจิจูด -180 ถึง 180)');
      }
    }
  };

  // ค้นหาสถานที่ผ่านระบบค้นหาหลังบ้าน Proxy API เพื่อความรวดเร็วและปลอดภัยจาก CORS
  const handleAddressSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError('');
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const results = await response.json();
        if (results && results.length > 0) {
          const firstResult = results[0];
          const targetLat = parseFloat(firstResult.lat);
          const targetLng = parseFloat(firstResult.lon);
          
          setLat(targetLat);
          setLng(targetLng);
          setZoom(15);
        } else {
          setSearchError('ไม่พบสถานที่ดังกล่าว กรุณาลองคำค้นหาอื่น');
        }
      } else {
        const errData = await response.json();
        setSearchError(errData.error || 'ระบบค้นหามีปัญหากระทันหัน กรุณาลองใหม่อีกครั้ง');
      }
    } catch (error) {
      setSearchError('เกิดข้อผิดพลาดในการค้นหา: ' + error.message);
    } finally {
      setSearching(false);
    }
  };



  // จัดการอัปโหลดไฟล์รูปภาพและแปลงเป็น Base64
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // จำกัดไม่เกิน 2MB
        alert('กรุณาเลือกรูปภาพที่มีขนาดไม่เกิน 2MB เพื่อความลื่นไหลของระบบจัดเก็บ');
        return;
      }
      setImageFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // ส่งข้อมูลฟอร์มเพื่อบันทึกลง API
  const handleSavePin = async (e) => {
    e.preventDefault();
    if (!locationName.trim()) {
      alert('กรุณากรอกชื่อสถานที่หรือการตั้งชื่อพิกัด');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: locationName,
        lat,
        lng,
        elevation,
        radiusElevations: radiusData,
        image: imageBase64,
        surveyCost: SURVEY_FEE
      };

      const response = await fetch('/api/pins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setLocationName('');
        setImageFile(null);
        setImageBase64('');
        // รีเฟรชรายการหมุด
        await fetchSavedPins();
        alert('บันทึกพิกัดและข้อมูลระดับความสูงลงฐานข้อมูลสำเร็จ!');
      } else {
        const errData = await response.json();
        alert('ไม่สามารถบันทึกได้: ' + errData.error);
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดขณะส่งบันทึก: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // ลบหมุดที่บันทึกไว้
  const handleDeletePin = async (id, name) => {
    if (!confirm(`คุณต้องการลบข้อมูลพิกัด "${name}" ใช่หรือไม่?`)) return;

    try {
      const response = await fetch(`/api/pins?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchSavedPins();
      } else {
        const errData = await response.json();
        alert('ไม่สามารถลบข้อมูลได้: ' + errData.error);
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
    }
  };

  // นำทางไปยังตำแหน่งหมุดที่บันทึกไว้
  const handleFlyToPin = (pin) => {
    setLat(pin.lat);
    setLng(pin.lng);
    setZoom(16);
    // เลื่อนหน้าจอขึ้นไปที่แผนที่
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ฟังก์ชันดาวน์โหลดไฟล์ CSV (สำหรับหมุดทั้งหมด หรือเฉพาะพิกัดเดียว)
  const downloadCSV = (pinsToExport, filename) => {
    // กำหนดหัวคอลัมน์
    const headers = [
      'ชื่อสถานที่',
      'ละติจูด',
      'ลองจิจูด',
      'ระดับความสูงจากระดับน้ำทะเลปานกลาง (เมตร)',
      'ทิศเหนือ (+50ม) (เมตร)',
      'ทิศใต้ (-50ม) (เมตร)',
      'ทิศตะวันออก (+50ม) (เมตร)',
      'ทิศตะวันตก (-50ม) (เมตร)',
      'ค่าธรรมเนียมสำรวจ (บาท)',
      'วันที่ปักหมุด'
    ];

    // สร้างเนื้อหาของไฟล์ CSV
    const rows = pinsToExport.map(pin => {
      const r = pin.radiusElevations || {};
      return [
        `"${pin.name.replace(/"/g, '""')}"`,
        pin.lat,
        pin.lng,
        pin.elevation.toFixed(2),
        (r.north !== undefined ? r.north.toFixed(2) : '-'),
        (r.south !== undefined ? r.south.toFixed(2) : '-'),
        (r.east !== undefined ? r.east.toFixed(2) : '-'),
        (r.west !== undefined ? r.west.toFixed(2) : '-'),
        pin.surveyCost.toFixed(2),
        new Date(pin.createdAt).toLocaleString('th-TH')
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    // เติม UTF-8 BOM (\uFEFF) เพื่อให้ Microsoft Excel เปิดภาษาไทยได้โดยไม่เพี้ยน
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (navigator.msSaveBlob) { // สำหรับ IE เก่า
      navigator.msSaveBlob(blob, filename);
    } else {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // สถิติ: หาพิกัดที่ระดับความสูงมากที่สุด
  const getHighestPin = () => {
    if (savedPins.length === 0) return null;
    return savedPins.reduce((prev, current) => (prev.elevation > current.elevation) ? prev : current);
  };

  const highestPin = getHighestPin();

  return (
    <div style={{ flex: 1, padding: '24px 16px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      {/* ส่วนหัวแสดงชื่อ "เล่นของสูง" */}
      <header className="animate-fade-in" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ 
          fontSize: '2.8rem', 
          fontWeight: '700', 
          color: 'var(--primary)',
          background: 'linear-gradient(135deg, var(--primary) 30%, var(--accent) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px'
        }}>
          เล่นของสูง 🏔️
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', fontWeight: 300 }}>
          ระบบเช็กระดับความสูงจากน้ำทะเลปานกลาง วิเคราะห์ระดับความสูงรอบทิศ และปักหมุดบันทึกข้อมูล
        </p>
        
        {/* แถบสถิติระดับความสูง */}
        {highestPin && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginTop: '16px',
            padding: '6px 16px',
            borderRadius: '50px',
            background: 'var(--accent-light)',
            color: 'var(--accent)',
            fontSize: '0.85rem',
            fontWeight: 500,
            border: '1px solid var(--accent)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            📍 พิกัดสูงสุดที่บันทึกไว้: {highestPin.name} ({highestPin.elevation.toLocaleString('th-TH', {minimumFractionDigits: 2})} ม. รทก.)
          </div>
        )}
      </header>

      {/* กริดหลักแบ่ง 2 คอลัมน์บนจอใหญ่ และ 1 คอลัมน์บนมือถือ */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
        gap: '24px',
        alignItems: 'start',
        marginBottom: '40px'
      }}>
        
        {/* คอลัมน์ที่ 1: ส่วนแผนที่และการค้นหาพิกัด */}
        <section className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🌐 แผนที่และค้นหาที่ตั้ง
          </h2>

          {/* ฟอร์มค้นหาที่อยู่จริงด้วยชื่อ */}
          <form onSubmit={handleAddressSearch} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="ค้นหาชื่อสถานที่ หรือที่อยู่ในไทย..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="ค้นหาที่อยู่"
              required
            />
            <button 
              type="submit" 
              disabled={searching}
              style={{
                backgroundColor: 'var(--primary)',
                color: 'white',
                padding: '0 20px',
                whiteSpace: 'nowrap'
              }}
            >
              {searching ? 'กำลังค้น...' : 'ค้นหา'}
            </button>
          </form>
          
          {searchError && (
            <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>
              ⚠️ {searchError}
            </div>
          )}

          {/* ส่วนแสดงผลแผนที่ */}
          <div style={{ height: '380px', marginBottom: '20px', position: 'relative' }}>
            <MapComponent
              lat={lat}
              lng={lng}
              zoom={zoom}
              onMapClick={handleMapClick}
              savedPins={savedPins}
            />
          </div>

          {/* ป้อนพิกัดแมนนวล */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              📍 หรือระบุละติจูดและลองจิจูดโดยตรง
            </h3>
            <form onSubmit={handleManualCoordsSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="manualLat" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ละติจูด (Lat)</label>
                <input
                  id="manualLat"
                  name="manualLat"
                  type="number"
                  step="any"
                  defaultValue={lat.toFixed(6)}
                  key={`lat-${lat}`}
                  style={{ padding: '8px 12px' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="manualLng" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ลองจิจูด (Lng)</label>
                <input
                  id="manualLng"
                  name="manualLng"
                  type="number"
                  step="any"
                  defaultValue={lng.toFixed(6)}
                  key={`lng-${lng}`}
                  style={{ padding: '8px 12px' }}
                />
              </div>
              <button 
                type="submit"
                style={{
                  backgroundColor: 'var(--border-color)',
                  color: 'var(--text-main)',
                  alignSelf: 'flex-end',
                  padding: '8px 16px',
                  height: '42px'
                }}
              >
                ย้ายพิกัด
              </button>
            </form>
          </div>
        </section>

        {/* คอลัมน์ที่ 2: ผลลัพธ์ เครื่องจำลองถมดิน และฟอร์มบันทึก */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* การ์ดความสูง */}
          <div className="glass-card pulse-border" style={{ padding: '24px', borderLeft: '5px solid var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏔️ ความสูง ณ พิกัดปัจจุบัน
              </h2>
              {loadingElevation && <span className="spinner"></span>}
            </div>

            {elevationError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginTop: '12px' }}>
                {elevationError}
              </div>
            )}

            {elevation !== null ? (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '3rem', fontWeight: '700', color: 'var(--accent)', letterSpacing: '-1px' }}>
                    {elevation >= 0 ? '+' : ''}{elevation.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                  <span style={{ fontSize: '1.2rem', fontWeight: '500', color: 'var(--text-muted)' }}>เมตร</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  เหนือระดับน้ำทะเลปานกลาง (Meters Above Mean Sea Level - MSL)
                </p>

                {/* ระดับความสูงรอบทิศในรัศมี 50 เมตร */}
                {radiusData && (
                  <div style={{ marginTop: '20px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>
                      📐 ระดับความสูงในรัศมี 50 เมตรโดยรอบ
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', textAlign: 'center' }}>
                      <div style={{ background: 'var(--background)', padding: '8px 4px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-muted)' }}>เหนือ (+50ม)</span>
                        <b style={{ fontSize: '0.85rem' }}>{radiusData.north.toFixed(2)}ม</b>
                      </div>
                      <div style={{ background: 'var(--background)', padding: '8px 4px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-muted)' }}>ใต้ (-50ม)</span>
                        <b style={{ fontSize: '0.85rem' }}>{radiusData.south.toFixed(2)}ม</b>
                      </div>
                      <div style={{ background: 'var(--primary-light)', padding: '8px 4px', borderRadius: '8px', border: '1px solid var(--primary)' }}>
                        <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--primary)', fontWeight: 600 }}>พิกัดนี้</span>
                        <b style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{radiusData.center.toFixed(2)}ม</b>
                      </div>
                      <div style={{ background: 'var(--background)', padding: '8px 4px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-muted)' }}>ออก (+50ม)</span>
                        <b style={{ fontSize: '0.85rem' }}>{radiusData.east.toFixed(2)}ม</b>
                      </div>
                      <div style={{ background: 'var(--background)', padding: '8px 4px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-muted)' }}>ตก (-50ม)</span>
                        <b style={{ fontSize: '0.85rem' }}>{radiusData.west.toFixed(2)}ม</b>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              !loadingElevation && <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>คลิกเลือกจุดบนแผนที่หรือป้อนพิกัดเพื่อดึงระดับความสูง</p>
            )}
          </div>



          {/* การ์ดบันทึกหมุด */}
          {elevation !== null && (
            <div className="glass-card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📌 บันทึกพิกัดเล่นของสูง
              </h2>
              <form onSubmit={handleSavePin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor="locationName" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>ตั้งชื่อพิกัด/สถานที่นี้</label>
                  <input
                    id="locationName"
                    type="text"
                    placeholder="เช่น ดอยปุย, บ้านคุณแม่ หรือ พิกัดถมที่ดิน 10 ไร่..."
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    📸 อัปโหลดรูปภาพจริงประกอบสถานที่ (ไม่เกิน 2MB)
                  </label>
                  <div style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    backgroundColor: 'var(--background)',
                    transition: 'border-color var(--transition-fast)'
                  }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                      aria-label="อัปโหลดรูปภาพสถานที่จริง"
                    />
                    {imageBase64 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <img 
                          src={imageBase64} 
                          alt="พรีวิวรูปภาพ" 
                          style={{ maxHeight: '120px', borderRadius: '8px', maxWidth: '100%', objectFit: 'cover' }} 
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>✓ โหลดไฟล์รูปภาพสำเร็จ (เปลี่ยนภาพคลิกพื้นที่นี้)</span>
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '4px' }}>📷</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>คลิกที่นี่หรือลากไฟล์ภาพวางเพื่ออัปโหลด</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <span>ค่าบริการสำรวจจำลอง: <b>50.00 บาท</b></span>
                  <span>(ทดสอบฟรี ไม่เก็บเงินจริง)</span>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'white',
                    padding: '12px 20px',
                    width: '100%',
                    fontSize: '1rem',
                    boxShadow: 'var(--shadow-md)'
                  }}
                >
                  {saving ? 'กำลังปักหมุดบันทึก...' : '💾 บันทึกลงฐานข้อมูลพิกัด'}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>

      {/* ส่วนประวัติการปักหมุด (Saved Pins Gallery) */}
      <section className="glass-card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid var(--border-color)', 
          paddingBottom: '16px', 
          marginBottom: '20px' 
        }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📌 รายการพิกัดปักหมุดที่บันทึกไว้ ({savedPins.length})
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
              ข้อมูลถูกเก็บถาวรในฐานข้อมูลไฟล์ JSON ในเครื่อง (data/pins.json)
            </p>
          </div>
          
          {savedPins.length > 0 && (
            <button 
              onClick={() => downloadCSV(savedPins, 'เล่นของสูง_พิกัดทั้งหมด.csv')}
              style={{
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                border: '1px solid var(--primary)',
                padding: '8px 16px',
                fontSize: '0.9rem'
              }}
            >
              📥 ส่งออกทุกพิกัดเป็น CSV
            </button>
          )}
        </div>

        {loadingPins ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <span className="spinner" style={{ marginBottom: '8px' }}></span>
            <p>กำลังค้นหาข้อมูลพิกัดที่บันทึกไว้...</p>
          </div>
        ) : savedPins.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px' }}>🗺️</span>
            <p>ยังไม่มีการปักหมุดและบันทึกข้อมูลไว้ ปักหมุดแรกเลยด้านบน!</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: '20px' 
          }}>
            {savedPins.map((pin) => (
              <div 
                key={pin.id} 
                className="glass-card animate-fade-in"
                style={{ 
                  overflow: 'hidden', 
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--card-bg)'
                }}
              >
                {/* รูปภาพสถานที่ */}
                <div style={{ 
                  height: '150px', 
                  backgroundColor: '#cbd5e1', 
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {pin.image ? (
                    <img 
                      src={pin.image} 
                      alt={pin.name} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#64748b' }}>
                      <span style={{ fontSize: '2rem', display: 'block' }}>🏔️</span>
                      <span style={{ fontSize: '0.75rem' }}>ไม่มีภาพประกอบ</span>
                    </div>
                  )}
                  {/* ป้ายแสดงระดับความสูงสว่างชัดเจน */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'var(--accent)',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '50px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {pin.elevation >= 0 ? '+' : ''}{pin.elevation.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ม.
                  </div>
                </div>

                {/* รายละเอียดหมุด */}
                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px', lineHeight: '1.4' }}>
                      {pin.name}
                    </h3>
                    
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                      <span>📍 พิกัด: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</span>
                      <span>💰 ค่าธรรมเนียมสำรวจ: {pin.surveyCost.toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท</span>
                      <span>📅 บันทึกเมื่อ: {new Date(pin.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* กลุ่มปุ่มคำสั่ง */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    borderTop: '1px solid var(--border-color)', 
                    paddingTop: '12px',
                    marginTop: '8px'
                  }}>
                    <button
                      onClick={() => handleFlyToPin(pin)}
                      title="ดูบนแผนที่และนำมาวิเคราะห์ใหม่"
                      style={{
                        flex: 1,
                        fontSize: '0.75rem',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        padding: '6px 0'
                      }}
                    >
                      🧭 ไปที่แผนที่
                    </button>
                    <button
                      onClick={() => downloadCSV([pin], `เล่นของสูง_${pin.name.replace(/\s+/g, '_')}.csv`)}
                      title="ส่งออกรายละเอียดเฉพาะหมุดนี้เป็นไฟล์ CSV"
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        backgroundColor: 'var(--border-color)',
                        color: 'var(--text-main)'
                      }}
                    >
                      📥 CSV
                    </button>
                    <button
                      onClick={() => handleDeletePin(pin.id, pin.name)}
                      title="ลบหมุดนี้ออกจากฐานข้อมูล"
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        backgroundColor: 'var(--danger-light)',
                        color: 'var(--danger)'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
