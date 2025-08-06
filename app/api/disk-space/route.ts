import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    // On récupère la taille totale (size) et la taille libre (avail)
    const { stdout } = await execAsync("df -BG /mnt/usb | tail -1");
    // Exemple de ligne : /dev/sda1  932G  123G  763G  14% /mnt/usb
    const parts = stdout.trim().split(/\s+/);
    const total = parts[1]; // ex: '932G'
    const free = parts[3];  // ex: '763G'
    // On retourne les valeurs sans le 'G'
    return NextResponse.json({ total: total.replace('G',''), free: free.replace('G','') });
  } catch (err) {
    return NextResponse.json({ error: "Erreur lors de la récupération de l'espace disque", details: String(err) }, { status: 500 });
  }
}
