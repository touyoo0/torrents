import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    const { stdout } = await execAsync('df -h /mnt/usb | tail -1 | awk \'{print $4}\'');
    // stdout contient l'espace libre, ex: "14G\n"
    const free = stdout.trim();
    return NextResponse.json({ free });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur lors de la récupération de l\'espace disque', details: String(err) }, { status: 500 });
  }
}
