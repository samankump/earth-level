import { NextResponse } from 'next/server';

// ฟังก์ชันจำลองความสูงสำหรับประเทศไทยเมื่อระบบออฟไลน์ (Deterministic Mock Elevation)
function getMockElevation(lat, lng) {
  // ดอยอินทนนท์ พิกัดจำลองจุดสูงสุด (18.5908, 98.4872) -> 2565 ม.
  const distToInthanon = Math.sqrt(Math.pow(lat - 18.5908, 2) + Math.pow(lng - 98.4872, 2));
  if (distToInthanon < 0.5) {
    const elevation = 2565.34 - (distToInthanon * 4000);
    return Math.max(150, elevation);
  }

  // กรุงเทพฯ (13.75, 100.5) -> ต่ำใกล้ทะเลปานกลาง
  if (lat >= 13.4 && lat <= 14.2 && lng >= 100.2 && lng <= 100.8) {
    const distToBkk = Math.sqrt(Math.pow(lat - 13.7563, 2) + Math.pow(lng - 100.5018, 2));
    const elevation = 1.52 + (distToBkk * 12) + (Math.sin(lat * 50) * 0.3);
    return Math.max(0.5, elevation);
  }

  // หาดป่าตอง ภูเก็ต (7.8972, 98.2954) -> ระดับน้ำทะเล
  const distToPatong = Math.sqrt(Math.pow(lat - 7.8972, 2) + Math.pow(lng - 98.2954, 2));
  if (distToPatong < 0.1) {
    const elevation = 0.45 + (distToPatong * 15);
    return Math.max(0.1, elevation);
  }

  // พื้นที่ภูมิภาคอื่นๆ
  if (lat > 17) {
    // ภาคเหนือ (เขตภูเขา)
    return 350 + Math.sin(lat * 3) * 120 + Math.cos(lng * 4) * 80;
  } else if (lat < 10) {
    // ภาคใต้ (แนวเขาเตี้ยสลับชายทะเล)
    return 35 + Math.abs(Math.sin(lat * 10) * Math.cos(lng * 10)) * 90;
  } else {
    // ภาคกลาง/อีสาน
    return 130 + Math.sin(lat * 2) * 45 + Math.cos(lng * 3) * 30;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');

    if (!latStr || !lngStr) {
      return NextResponse.json({ error: 'กรุณาระบุพิกัด lat และ lng' }, { status: 400 });
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'พิกัดละติจูดหรือลองจิจูดไม่ถูกต้อง' }, { status: 400 });
    }

    // คำนวณระยะ 50 เมตรเป็นหน่วยองศา (Latitude/Longitude Offset)
    const latOffset = 50 / 111111;
    const lonOffset = 50 / (111111 * Math.cos((lat * Math.PI) / 180));

    // เรียงจุดดึงข้อมูล: 0=จุดศูนย์กลาง, 1=เหนือ, 2=ใต้, 3=ตะวันออก, 4=ตะวันตก
    const lats = [lat, lat + latOffset, lat - latOffset, lat, lat];
    const lons = [lng, lng, lng, lng + lonOffset, lng - lonOffset];

    const url = `https://elevation-api.open-meteo.com/v1/elevation?latitude=${lats.join(',')}&longitude=${lons.join(',')}`;

    try {
      // ดึงข้อมูลจริงจาก Open-Meteo
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      
      if (!response.ok) {
        throw new Error(`Open-Meteo API ตอบกลับด้วยสถานะ: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.elevation && data.elevation.length === 5) {
        return NextResponse.json({
          center: data.elevation[0],
          north: data.elevation[1],
          south: data.elevation[2],
          east: data.elevation[3],
          west: data.elevation[4],
          isMock: false
        });
      } else {
        throw new Error('โครงสร้างข้อมูลระดับความสูงไม่ครบถ้วน');
      }
    } catch (apiError) {
      // หากเกิดปัญหาในการเชื่อมต่อเว็บภายนอก (เช่น DNS error หรือ Offline) ให้ใช้ระบบคำนวณจำลองแทน
      console.warn('ไม่สามารถเชื่อมต่อ Open-Meteo API ได้, สลับใช้ระบบภูมิประเทศจำลอง:', apiError.message);
      
      return NextResponse.json({
        center: getMockElevation(lat, lng),
        north: getMockElevation(lat + latOffset, lng),
        south: getMockElevation(lat - latOffset, lng),
        east: getMockElevation(lat, lng + lonOffset),
        west: getMockElevation(lat, lng - lonOffset),
        isMock: true
      });
    }
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการดึงความสูงที่ฝั่งเซิร์ฟเวอร์:', error);
    return NextResponse.json(
      { error: 'ไม่สามารถประมวลผลความสูงได้: ' + error.message },
      { status: 500 }
    );
  }
}
