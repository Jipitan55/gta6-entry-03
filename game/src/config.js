// Porto Verde - Config Constants
export const CONFIG = {
  SAVE_KEY: 'portoverde-save-v1',
  GRID_SIZE: 9, // 9x9 city blocks
  BLOCK_SIZE: 40, // 40m per block
  ROAD_WIDTH: 12, // 12m road width
  SIDEWALK_WIDTH: 4, // 4m sidewalk
  WORLD_SIZE: 9 * (40 + 12 + 8), // approx total city size
  PLAYER_SPEED: 6.0,
  PLAYER_RUN_SPEED: 11.0,
  CAR_MAX_SPEED: 25.0,
  CAR_ACCEL: 12.0,
  CAR_BRAKE: 18.0,
  CAR_STEER: 1.8,
  COLORS: {
    sky: 0x1a0933, // sunset purple/orange gradient feel
    ground: 0x1c1c22,
    road: 0x222228,
    sidewalk: 0x777780,
    buildingBase: 0x3a3a48,
    water: 0x0066aa,
    sand: 0xc2b280,
    playerShirt: 0xff3366,
    playerPants: 0x112233,
    carColors: [0xff2222, 0x2266ff, 0xffffff, 0x222222, 0xffaa00, 0x33aa33]
  }
};
