import * as migration_20260908_130245_initial from './20260908_130245_initial';

export const migrations = [
  {
    up: migration_20260908_130245_initial.up,
    down: migration_20260908_130245_initial.down,
    name: '20260908_130245_initial'
  },
];
