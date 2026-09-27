/**
 * TDD tests for the PlayerStats value object (#528, Phase 2).
 */
import { describe, test, expect } from 'vitest';
import { PlayerStats } from '../src/domain/value-objects/PlayerStats.js';

describe('PlayerStats', () => {
  describe('create', () => {
    test('음수 필드는 에러를 던진다', () => {
      expect(() =>
        PlayerStats.create({
          playTimeSeconds: -1,
          deaths: 0,
          mobKills: 0,
          playerKills: 0,
          distanceMeters: 0,
          blocksMined: 0,
          itemsCrafted: 0,
          advancementsCompleted: 0,
        })
      ).toThrow();
    });

    test('toJSON은 순수 객체를 반환한다', () => {
      const stats = PlayerStats.create({
        playTimeSeconds: 120,
        deaths: 1,
        mobKills: 2,
        playerKills: 3,
        distanceMeters: 4,
        blocksMined: 5,
        itemsCrafted: 6,
        advancementsCompleted: 7,
      });
      expect(stats.toJSON()).toEqual({
        playTimeSeconds: 120,
        deaths: 1,
        mobKills: 2,
        playerKills: 3,
        distanceMeters: 4,
        blocksMined: 5,
        itemsCrafted: 6,
        advancementsCompleted: 7,
      });
    });
  });

  describe('fromMinecraftJson', () => {
    test('바닐라 stats.json + advancements.json을 파싱한다', () => {
      const statsJson = {
        stats: {
          'minecraft:custom': {
            'minecraft:play_time': 1200,
            'minecraft:deaths': 2,
            'minecraft:mob_kills': 5,
            'minecraft:player_kills': 0,
            'minecraft:walk_one_cm': 1000,
            'minecraft:swim_one_cm': 500,
          },
          'minecraft:mined': { 'minecraft:stone': 3, 'minecraft:dirt': 2 },
          'minecraft:crafted': { 'minecraft:stick': 4 },
        },
        DataVersion: 3465,
      };
      const advancementsJson = {
        'minecraft:story/root': { criteria: {}, done: true },
        'minecraft:story/mine_diamond': { criteria: {}, done: false },
        'minecraft:recipes/misc/stick': { criteria: {}, done: true },
        DataVersion: 3465,
      };

      const stats = PlayerStats.fromMinecraftJson(statsJson, advancementsJson);

      expect(stats.playTimeSeconds).toBe(60);
      expect(stats.deaths).toBe(2);
      expect(stats.mobKills).toBe(5);
      expect(stats.playerKills).toBe(0);
      expect(stats.distanceMeters).toBe(15);
      expect(stats.blocksMined).toBe(5);
      expect(stats.itemsCrafted).toBe(4);
      expect(stats.advancementsCompleted).toBe(1);
    });

    test('구버전 minecraft:play_one_minute을 사용한다', () => {
      const statsJson = {
        stats: { 'minecraft:custom': { 'minecraft:play_one_minute': 200 } },
      };

      const stats = PlayerStats.fromMinecraftJson(statsJson);
      expect(stats.playTimeSeconds).toBe(10);
    });

    test('섹션이 없으면 0으로 채운다', () => {
      const stats = PlayerStats.fromMinecraftJson({});
      expect(stats).toEqual(
        expect.objectContaining({
          playTimeSeconds: 0,
          deaths: 0,
          mobKills: 0,
          playerKills: 0,
          distanceMeters: 0,
          blocksMined: 0,
          itemsCrafted: 0,
          advancementsCompleted: 0,
        })
      );
    });

    test('advancementsJson이 없으면 advancementsCompleted는 0이다', () => {
      const stats = PlayerStats.fromMinecraftJson({});
      expect(stats.advancementsCompleted).toBe(0);
    });

    test('recipes/*와 DataVersion은 도전과제 집계에서 제외한다', () => {
      const advancementsJson = {
        'minecraft:recipes/misc/torch': { criteria: {}, done: true },
        'minecraft:recipes/misc/stick': { criteria: {}, done: true },
        DataVersion: 3465,
      };
      const stats = PlayerStats.fromMinecraftJson({}, advancementsJson);
      expect(stats.advancementsCompleted).toBe(0);
    });

    test('overflow된(음수) int 카운터는 unsigned 32-bit로 재해석한다', () => {
      const statsJson = {
        stats: {
          'minecraft:custom': {
            'minecraft:walk_one_cm': -2147483648, // overflowed int: real distance was > 21,474 km
          },
        },
      };

      const stats = PlayerStats.fromMinecraftJson(statsJson);
      // -2147483648 + 2**32 = 2147483648 cm -> 21474836.48 m, rounded to nearest meter
      expect(stats.distanceMeters).toBe(21474836);
    });

    test('정수가 아닌 음수 값은 0으로 취급한다', () => {
      const statsJson = {
        stats: {
          'minecraft:custom': {
            'minecraft:deaths': -1.5,
          },
        },
      };

      const stats = PlayerStats.fromMinecraftJson(statsJson);
      expect(stats.deaths).toBe(0);
    });
  });
});
