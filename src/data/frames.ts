// NYU Torch ASCII Animation Frames
// Characters wrapped in <b>...</b> are rendered in NYU purple (highlighted)
// The flame (top ~7 lines) changes each frame; the body remains constant.

const torchBody = [
  // Cup (rectangular section between flame and handle)
  "          <b>##########</b>          ",
  "          <b>##########</b>          ",
  "          <b>##########</b>          ",
  // Handle (isosceles triangle, tapering to a point)
  "           <b>########</b>           ",
  "           <b>########</b>           ",
  "            <b>######</b>            ",
  "             <b>####</b>             ",
  "             <b>####</b>             ",
  "              <b>##</b>              ",
  "              <b>##</b>              ",
  // NYU text
  "                              ",
  "          <b>N</b>    <b>Y</b>    <b>U</b>         ",
];

const flames: string[][] = [
  // Frame 0 (centered)
  [
    "              .               ",
    "        .  <b>*</b>     <b>*</b>            ",
    "         <b>@@@@@@@@@@@@</b>         ",
    "       <b>@@@@@@@@@@@@@@@@</b>       ",
    "        <b>@@@@@@@@@@@@@@</b>        ",
    "         <b>@@@@@@@@@@@@</b>         ",
    "          <b>@@@@@@@@@@</b>          ",
  ],
  // Frame 1 (shifted right)
  [
    "             <b>*</b>                ",
    "           . <b>@@</b> .             ",
    "          <b>@@@@@@@@@@@@</b>        ",
    "        <b>@@@@@@@@@@@@@@@@</b>      ",
    "         <b>@@@@@@@@@@@@@@</b>       ",
    "          <b>@@@@@@@@@@@@</b>        ",
    "          <b>@@@@@@@@@@</b>          ",
  ],
  // Frame 2 (shifted left)
  [
    "         .      <b>*</b>             ",
    "           <b>*</b> <b>@@</b>  .            ",
    "        <b>@@@@@@@@@@@@</b>          ",
    "      <b>@@@@@@@@@@@@@@@@</b>        ",
    "       <b>@@@@@@@@@@@@@@</b>         ",
    "        <b>@@@@@@@@@@@@</b>          ",
    "          <b>@@@@@@@@@@</b>          ",
  ],
  // Frame 3 (tall flame)
  [
    "               .              ",
    "        <b>*</b>   <b>@@@@</b>   .          ",
    "         <b>@@@@@@@@@@@@</b>         ",
    "       <b>@@@@@@@@@@@@@@@@</b>       ",
    "       <b>@@@@@@@@@@@@@@@@</b>       ",
    "         <b>@@@@@@@@@@@@</b>         ",
    "          <b>@@@@@@@@@@</b>          ",
  ],
  // Frame 4 (centered, narrow top)
  [
    "           <b>*</b>    .             ",
    "           <b>@@@@@@@@</b>           ",
    "        <b>@@@@@@@@@@@@@@</b>        ",
    "       <b>@@@@@@@@@@@@@@@@</b>       ",
    "        <b>@@@@@@@@@@@@@@</b>        ",
    "         <b>@@@@@@@@@@@@</b>         ",
    "          <b>@@@@@@@@@@</b>          ",
  ],
  // Frame 5 (centered, wide)
  [
    "              <b>*</b>               ",
    "        .  <b>@@@@@@</b>  <b>*</b>          ",
    "         <b>@@@@@@@@@@@@</b>         ",
    "       <b>@@@@@@@@@@@@@@@@</b>       ",
    "        <b>@@@@@@@@@@@@@@</b>        ",
    "         <b>@@@@@@@@@@@@</b>         ",
    "          <b>@@@@@@@@@@</b>          ",
  ],
  // Frame 6 (quiet, very wide middle)
  [
    "                              ",
    "          .  <b>@@</b>  .            ",
    "         <b>@@@@@@@@@@@@</b>         ",
    "      <b>@@@@@@@@@@@@@@@@@@</b>      ",
    "        <b>@@@@@@@@@@@@@@</b>        ",
    "         <b>@@@@@@@@@@@@</b>         ",
    "          <b>@@@@@@@@@@</b>          ",
  ],
  // Frame 7 (shifted right slightly)
  [
    "            .   <b>*</b>             ",
    "         <b>*</b>  <b>@@@@</b>  .           ",
    "         <b>@@@@@@@@@@@@</b>         ",
    "        <b>@@@@@@@@@@@@@@@@</b>      ",
    "        <b>@@@@@@@@@@@@@@</b>        ",
    "         <b>@@@@@@@@@@@@</b>         ",
    "          <b>@@@@@@@@@@</b>          ",
  ],
];

export const frames: string[][] = flames.map((flame) => [...flame, ...torchBody]);
