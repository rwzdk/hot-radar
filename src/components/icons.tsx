/* 贴纸风手绘图标:ink 粗描边 + 局部彩色填充,viewBox 统一 0 0 24 24 */

const INK = '#3B2F2A';

interface IconProps {
  className?: string;
}

type P = IconProps & React.SVGProps<SVGSVGElement>;

function base(props: P) {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    ...props,
  };
}

/** Logo 雷达:白色描边,置于橙色气泡底盒内使用 */
export function RadarIcon(props: P) {
  return (
    <svg {...base(props)} stroke="#fff" strokeWidth={2.1} strokeLinecap="round">
      <circle cx="12" cy="12" r="1.8" fill="#fff" stroke="none" />
      <path d="M12 12l4.6-4.6" />
      <path d="M12 5.3a6.7 6.7 0 0 1 6.8 6.6" />
      <path d="M12 8.6a3.4 3.4 0 0 1 3.5 3.3" />
      <path d="M12 18.7a6.7 6.7 0 0 1-6.8-6.6" />
      <path d="M12 15.4a3.4 3.4 0 0 1-3.5-3.3" />
    </svg>
  );
}

/** 火焰:热榜/热度 */
export function FlameIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path
        d="M12.2 2.8c.5 2.2 2.9 3.5 3.9 5.6 1.1 2.3.9 5.3-.7 7.2-1.7 2-4.6 2.6-7 1.6-2.3-1-3.9-3.4-3.7-5.9.1-1.9 1.1-3.5 2.4-4.7.3 1 .9 1.9 1.9 2.2-.2-2.1.5-4.3 1.7-6z"
        fill="#FF6B35"
        stroke={INK}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <path
        d="M12 12.3c1.1 1.1 1.8 2.3 1.6 3.7-.2 1.3-1.3 2.2-2.6 2.1-1.2-.1-2.1-1.2-2-2.4.1-1.2 1.8-2.2 3-3.4z"
        fill="#FFC94D"
        stroke={INK}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 靶心:关键词监控 */
export function TargetIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 3.6c4.7-.3 8.6 3.7 8.3 8.5-.2 4.6-3.9 8.2-8.5 8.2-4.5.1-8.2-3.8-8.1-8.4C3.8 7.4 7.4 3.9 12 3.6z"
        fill="#DDF3EF"
        stroke={INK}
        strokeWidth={1.8}
      />
      <path
        d="M12 7.4c2.6-.1 4.7 2 4.6 4.6-.1 2.5-2.1 4.4-4.6 4.4-2.5 0-4.5-2-4.4-4.5.1-2.4 2.1-4.4 4.6-4.5z"
        fill="#2A9D8F"
        stroke={INK}
        strokeWidth={1.5}
      />
      <circle cx="12" cy="12" r="1.6" fill="#FFC94D" stroke={INK} strokeWidth={1.2} />
    </svg>
  );
}

/** 放大镜:全网搜索 */
export function SearchIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path
        d="M10.8 4.3c3.6-.2 6.6 2.7 6.5 6.3-.1 3.5-3 6.3-6.5 6.2-3.4 0-6.2-2.9-6.1-6.4.1-3.4 2.8-6 6.1-6.1z"
        fill="#E3EEFF"
        stroke={INK}
        strokeWidth={1.8}
      />
      <path d="M15.5 15.5l4.4 4.4" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <path
        d="M8 8.4c.7-.9 1.7-1.5 2.8-1.5"
        stroke={INK}
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** 齿轮:设置 */
export function GearIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 3.6l1.3 2.1 2.4-.4.9 2.2 2.3.7-.5 2.4 1.7 1.7-1.7 1.7.5 2.4-2.3.7-.9 2.2-2.4-.4-1.3 2.1-1.3-2.1-2.4.4-.9-2.2-2.3-.7.5-2.4L3.3 12l1.7-1.7-.5-2.4 2.3-.7.9-2.2 2.4.4z"
        fill="#FFC94D"
        stroke={INK}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.9" fill="#FFFDF7" stroke={INK} strokeWidth={1.5} />
    </svg>
  );
}

/** 铃铛:铃身填充随场景(顶栏白、强调黄) */
export function BellIcon({ bodyFill = '#FFC94D', ...props }: P & { bodyFill?: string }) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 3.8c-3.1 0-5 2.5-5 5.5 0 2.9-.9 4.1-1.8 5.3-.3.4 0 1 .5 1h12.6c.5 0 .8-.6.5-1-.9-1.2-1.8-2.4-1.8-5.3 0-3-1.9-5.5-4.8-5.5z"
        fill={bodyFill}
        stroke={INK}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <path
        d="M10 18.6c.3 1 1 1.6 2 1.6s1.7-.6 2-1.6"
        fill="none"
        stroke={INK}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 刷新:描边跟随文字色 */
export function RefreshIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.5 8.5A8 8 0 0 0 5.9 5.5" />
      <path d="M4 2.8v3.6h3.6" />
      <path d="M4.5 15.5A8 8 0 0 0 18.1 18.5" />
      <path d="M20 21.2v-3.6h-3.6" />
    </svg>
  );
}

/** 手绘星星:fill 可换色(装饰用 teal/orange) */
export function SparkIcon({ fill = '#FFC94D', ...props }: P & { fill?: string }) {
  return (
    <svg {...base(props)}>
      <path
        d="M12 2.5l2 5.8 5.8 1.7-5.8 2-2 5.8-2-5.8-5.8-2 5.8-1.7z"
        fill={fill}
        stroke={INK}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlusIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrashIcon(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 7h15M9.5 7V4.5h5V7" fill="#FFC94D" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path
        d="M6 7l1 12.5h10L18 7"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PauseIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M9 5.5v13M15 5.5v13" />
    </svg>
  );
}

export function PlayIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M8 5.5 18.5 12 8 18.5Z" />
    </svg>
  );
}

export function XIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function CheckIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m4.5 12.5 4.5 4.5L19.5 6.5" />
    </svg>
  );
}

export function ExternalIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4.5h5.5V10" />
      <path d="M19 5 11.5 12.5" />
      <path d="M18.5 14v4.5a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1H10" />
    </svg>
  );
}

export function DownloadIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 18v2.5h15V18" />
    </svg>
  );
}

export function UploadIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4.5 18v2.5h15V18" />
    </svg>
  );
}

export function CopyIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function FileTextIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 3.5h7l4 4v13h-11z" fill="#FFF3D6" />
      <path d="M13.5 3.5v4h4" />
      <path d="M9 12h6M9 15h6M9 18h4" />
    </svg>
  );
}

export function KeyIcon(props: P) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="15.5" r="4.2" fill="#FFE3D3" stroke={INK} strokeWidth={1.8} />
      <path d="m11 12.5 8.5-8.5" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <path d="M16.6 6.9l2.4 2.4M14.2 4.5l2.4 2.4" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

export function DatabaseIcon(props: P) {
  return (
    <svg {...base(props)}>
      <ellipse cx="12" cy="5.8" rx="7.5" ry="2.7" fill="#DDF3EF" stroke={INK} strokeWidth={1.8} />
      <path
        d="M4.5 5.8v12.4c0 1.5 3.4 2.7 7.5 2.7s7.5-1.2 7.5-2.7V5.8"
        stroke={INK}
        strokeWidth={1.8}
      />
      <path d="M4.5 12c0 1.5 3.4 2.7 7.5 2.7s7.5-1.2 7.5-2.7" stroke={INK} strokeWidth={1.8} />
    </svg>
  );
}

export function ShieldIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M12 3 5 5.5v6c0 4.5 3 7.5 7 9.5 4-2 7-5 7-9.5v-6Z" />
    </svg>
  );
}

export function GithubIcon(props: P) {
  return (
    <svg {...base(props)} stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 2.8a9.2 9.2 0 0 0-2.9 17.9c.5.1.6-.2.6-.4v-1.7c-2.6.6-3.1-1.1-3.1-1.1-.4-1-1-1.3-1-1.3-.9-.6.1-.6.1-.6.9.1 1.4 1 1.4 1 .8 1.5 2.2 1 2.7.8.1-.6.3-1 .6-1.3-2-.2-4.2-1-4.2-4.6 0-1 .4-1.8 1-2.5-.1-.2-.4-1.2.1-2.5 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.5.6.7 1 1.5 1 2.5 0 3.6-2.2 4.4-4.3 4.6.3.3.6.9.6 1.8v2.7c0 .2.2.5.7.4A9.2 9.2 0 0 0 12 2.8Z" />
    </svg>
  );
}
