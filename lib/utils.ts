import * as fs from 'fs';
 
export function getSubnetCidr(vpcCidr: string, offset: number): string {
  const [ip, prefix] = vpcCidr.split("/");
  const octets = ip.split(".").map(Number);

  if (octets.length !== 4 || parseInt(prefix) < 16) {
    throw new Error("Invalid CIDR block");
  }
  return `${octets[0]}.${octets[1]}.${octets[2] + offset}.0/24`;
}


export function getFileString(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Error reading file "${filePath}":`, error);
    return '';
  }
}
