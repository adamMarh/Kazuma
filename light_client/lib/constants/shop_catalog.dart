const Map<String, String?> shopItemPreviewImages = {
  // Characters
  'chat_astral': 'assets/images/avatars-images/avatar13.png',
  'chien_gardien': 'assets/images/avatars-images/avatar14.png',
  'lapin_lunaire': 'assets/images/avatars-images/avatar15.png',

  // Sounds
  'snd_win_music': null,
  'snd_attack': null,
  'snd_flag_music': null,

  // Visuals
  'vis_aura': null,
  'vis_flag_custom': null,
  'vis_police_nom': null,
};

String? getShopItemPreviewImage(String itemId) {
  return shopItemPreviewImages[itemId];
}

String getShopItemDisplayName(String itemId) {
  const overrides = {
    // Visuals (match server names)
    'vis_aura': 'Aura Blanche',
    'vis_flag_custom': 'Couronne Stellaire',
    'vis_police_nom': 'Nom Enchanté',
    // Sounds
    'snd_win_music': 'Musique Victoire',
    'snd_attack': 'Son Attaque',
    'snd_flag_music': 'Musique Flag',
    // Characters (match server names)
    'chat_astral': 'Chat Astral',
    'chien_gardien': 'Chien Gardien',
    'lapin_lunaire': 'Lapin Lunaire',
  };
  if (overrides.containsKey(itemId)) return overrides[itemId]!;

  final cleaned = itemId.replaceFirst(RegExp(r'^(char_|vis_|snd_|item_)'), '');
  final parts = cleaned
      .split('_')
      .map((p) => p.isEmpty ? p : '${p[0].toUpperCase()}${p.substring(1)}')
      .toList();
  return parts.join(' ');
}

String? getShopItemVisualClass(String itemId) {
  const visualClasses = {
    'vis_aura': 'visual-aura',
    'vis_flag_custom': 'visual-stars',
    'vis_police_nom': 'visual-enchanted',
  };
  return visualClasses[itemId];
}

const Map<String, String?> shopItemSounds = {
  'snd_win_music': 'assets/sounds/victory.wav',
  'snd_attack': 'assets/sounds/attack.wav',
  'snd_flag_music': 'assets/sounds/flag.wav',
};

String? getShopItemSound(String itemId) {
  return shopItemSounds[itemId];
}
