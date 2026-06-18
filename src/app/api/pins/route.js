import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// กำหนดพาธไฟล์ฐานข้อมูล JSON
const dbPath = path.join(process.cwd(), 'data', 'pins.json');

// ฟังก์ชันช่วยอ่านข้อมูลจากไฟล์
async function readPins() {
  try {
    const data = await fs.readFile(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // หากไม่มีไฟล์ ให้สร้างอาเรย์ว่าง
    return [];
  }
}

// ฟังก์ชันช่วยเขียนข้อมูลลงไฟล์
async function writePins(pins) {
  // สร้างโฟลเดอร์หลักของไฟล์หากยังไม่มี
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(pins, null, 2), 'utf8');
}

// GET: ดึงข้อมูลหมุดทั้งหมด
export async function GET() {
  try {
    const pins = await readPins();
    // เรียงลำดับตามความสดใหม่ (ล่าสุดอยู่ด้านบน)
    const sortedPins = pins.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return NextResponse.json(sortedPins);
  } catch (error) {
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลหมุดได้: ' + error.message },
      { status: 500 }
    );
  }
}

// POST: บันทึกข้อมูลหมุดใหม่
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, lat, lng, elevation, radiusElevations, image, surveyCost, landFillCost } = body;

    // ตรวจสอบความถูกต้องของข้อมูลเบื้องต้น
    if (!name || lat === undefined || lng === undefined || elevation === undefined) {
      return NextResponse.json(
        { error: 'ข้อมูลที่ป้อนไม่ครบถ้วน (ต้องการ ชื่อสถานที่, ละติจูด, ลองจิจูด, ความสูง)' },
        { status: 400 }
      );
    }

    const pins = await readPins();
    
    // สร้างหมุดใหม่
    const newPin = {
      id: `pin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      elevation: parseFloat(elevation),
      radiusElevations: radiusElevations || null,
      image: image || '',
      surveyCost: parseFloat(surveyCost) || 50.00,
      landFillCost: parseFloat(landFillCost) || 0.00,
      createdAt: new Date().toISOString()
    };

    pins.push(newPin);
    await writePins(pins);

    return NextResponse.json(newPin, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'ไม่สามารถบันทึกข้อมูลหมุดได้: ' + error.message },
      { status: 500 }
    );
  }
}

// DELETE: ลบข้อมูลหมุด
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ระบุรหัสหมุดที่ต้องการลบ (id) ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    let pins = await readPins();
    const pinExists = pins.some(pin => pin.id === id);

    if (!pinExists) {
      return NextResponse.json(
        { error: 'ไม่พบหมุดที่ระบุในระบบ' },
        { status: 404 }
      );
    }

    pins = pins.filter(pin => pin.id !== id);
    await writePins(pins);

    return NextResponse.json({ success: true, message: 'ลบหมุดเรียบร้อยแล้ว' });
  } catch (error) {
    return NextResponse.json(
      { error: 'ไม่สามารถลบข้อมูลหมุดได้: ' + error.message },
      { status: 500 }
    );
  }
}
