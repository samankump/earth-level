'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function MapComponent({ lat, lng, onMapClick, savedPins = [], zoom = 12 }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const activeMarkerRef = useRef(null);
  const savedMarkersRef = useRef([]);

  // ตั้งค่า Marker Icon พื้นฐานของ Leaflet ป้องกันปัญหาหาภาพไม่เจอ
  useEffect(() => {
    // แก้ไขไอคอนเริ่มต้น
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    });
  }, []);

  // เริ่มสร้างแผนที่ครังแรก
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // หากมีแผนที่สร้างไว้แล้ว ไม่ต้องสร้างซ้ำ
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
      }).setView([lat, lng], zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ผู้ร่วมพัฒนา',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // เมื่อคลิกแผนที่ ให้แจ้งพิกัดใหม่กลับไป
      map.on('click', (e) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    // ล้างแผนที่เมื่อ unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        activeMarkerRef.current = null;
      }
    };
  }, []);

  // อัปเดตเมื่อพิกัดปักหมุดปัจจุบัน (lat, lng) เปลี่ยนแปลง
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // เคลื่อนย้ายมุมกล้องไปยังจุดใหม่
    map.setView([lat, lng]);

    // จัดการตัวปักหมุดหลัก (Active Marker)
    if (activeMarkerRef.current) {
      activeMarkerRef.current.setLatLng([lat, lng]);
    } else {
      // สร้างตัวปักหมุดหลักสีน้ำเงิน ลากดึงได้
      const activeIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      const marker = L.marker([lat, lng], {
        icon: activeIcon,
        draggable: true,
        zIndexOffset: 1000 // ให้ตัวนี้อยู่ด้านบนสุดเสมอ
      }).addTo(map);

      // เมื่อผู้ใช้ลากหมุดไปปล่อย ให้ส่งพิกัดกลับ
      marker.on('dragend', (e) => {
        const newLatLng = e.target.getLatLng();
        onMapClick(newLatLng.lat, newLatLng.lng);
      });

      activeMarkerRef.current = marker;
    }
  }, [lat, lng]);

  // อัปเดตเมื่อรายการหมุดที่บันทึกไว้ (savedPins) เปลี่ยนแปลง
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // ลบหมุดเก่าที่บันทึกไว้ในแผนที่ออกก่อน
    savedMarkersRef.current.forEach(marker => marker.remove());
    savedMarkersRef.current = [];

    // สร้างไอคอนหมุดสีเขียวสำหรับพิกัดที่บันทึกไว้แล้ว
    const savedIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    savedPins.forEach(pin => {
      // ป้องกันการทับซ้อนหน้าตาของหมุดหลักที่กำลังเลือก
      if (Math.abs(pin.lat - lat) < 0.00001 && Math.abs(pin.lng - lng) < 0.00001) {
        return;
      }

      const marker = L.marker([pin.lat, pin.lng], {
        icon: savedIcon,
      })
      .addTo(map)
      .bindPopup(`
        <div style="font-family: var(--font-family); min-width: 140px;">
          <strong style="color: var(--accent); font-size: 0.95rem;">📌 ${pin.name}</strong>
          <div style="margin-top: 4px; font-size: 0.85rem;">
            ความสูง: <b>${pin.elevation.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ม.</b><br/>
            พิกัด: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}
          </div>
        </div>
      `);

      savedMarkersRef.current.push(marker);
    });
  }, [savedPins, lat, lng]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '380px' }}>
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%', minHeight: '380px', borderRadius: '16px' }}
      />
      
      {/* คู่มือสั้นๆ แสดงบนแผนที่ */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        zIndex: 500,
        background: 'var(--card-bg)',
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '0.75rem',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        color: 'var(--text-main)',
        pointerEvents: 'none'
      }}>
        🔵 หมุดปัจจุบัน (ลากได้) | 🟢 หมุดที่ถูกบันทึก
      </div>
    </div>
  );
}
