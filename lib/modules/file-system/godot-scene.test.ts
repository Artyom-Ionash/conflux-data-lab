import { beforeEach, describe, expect, it } from 'vitest';

import { GodotSceneParser } from './godot-scene';

describe('GodotSceneParser', () => {
  let parser: GodotSceneParser;

  beforeEach(() => {
    parser = new GodotSceneParser();
  });

  it('parses a simple node structure', () => {
    const input = `
[gd_scene load_steps=2 format=3 uid="uid://test"]

[node name="Root" type="Node2D"]

[node name="Player" type="CharacterBody2D" parent="."]
position = Vector2(100, 100)
    `;

    const output = parser.parse(input);

    // Ожидаем дерево
    expect(output).toContain('Root [Node2D]');
    expect(output).toContain('  Player [CharacterBody2D]');
  });

  it('handles external resources', () => {
    const input = `
[ext_resource path="res://icon.svg" type="Texture" id=1]
[node name="Sprite" type="Sprite2D"]
texture = ExtResource( 1 )
     `;
    const output = parser.parse(input);
    expect(output).toContain('Sprite [Sprite2D]');
  });

  it('handles nested hierarchy', () => {
    const input = `
[node name="Grandparent" type="Node"]
[node name="Parent" type="Node" parent="."]
[node name="Child" type="Node" parent="Parent"]
      `;

    const output = parser.parse(input);
    // Проверяем отступы
    const lines = output.split('\n').filter(Boolean);
    expect(lines[0]?.trim()).toBe('Grandparent [Node]');
    expect(lines[1]?.startsWith('  ')).toBe(true); // Parent indented
    expect(lines[2]?.startsWith('    ')).toBe(true); // Child double indented
  });
});
