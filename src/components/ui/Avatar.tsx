"use client";

type Props = {
  name: string;
  src?: string | null;
  size?: number;        // px
  title?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}
function colorFrom(name: string) {
  const p = ["#1abc9c","#2ecc71","#3498db","#9b59b6","#f39c12","#e67e22","#e74c3c","#16a085","#27ae60","#2980b9","#8e44ad","#d35400","#c0392b"];
  let h = 0; for (let i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i))>>>0;
  return p[h % p.length];
}

export default function Avatar({ name, src, size=28, title }: Props) {
  const bg = colorFrom(name);
  return (
    <div
      className="bx-avatar"
      title={title || name}
      style={{ width:size, height:size, fontSize: Math.round(size*0.42) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} />
      ) : (
        <span style={{ background:bg }}>{initials(name)}</span>
      )}
    </div>
  );
}
