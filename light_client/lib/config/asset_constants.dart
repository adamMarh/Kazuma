const Map<String, String> tileAssets = {
  'grass': 'assets/tiles/grass.png',
  'water': 'assets/tiles/water.png',
  'ice': 'assets/tiles/ice.png',
  'wall': 'assets/tiles/wall.png',
  'doorOpen': 'assets/tiles/door-open.png',
  'doorClose': 'assets/tiles/door-closed.png',
};

const Map<String, String> itemAssets = {
  'shield': 'assets/items/shield.png',
  'lance': 'assets/items/lance.png',
  'potion': 'assets/items/lean.png',
  'crystal': 'assets/items/vvs.png',
  'compas': 'assets/items/compas.png',
  'hourglass': 'assets/items/hourglass.png',
  'random': 'assets/items/dice.png',
  'flag': 'assets/items/flag.png',
  'checkpoint': 'assets/icons/checkpoints.png',
  'hidden_checkpoint': 'assets/icons/checkpoints.png',
};

String avatarAsset(String avatarId) {
  String id = avatarId.replaceAll('.png', '').replaceAll('avatar', '');
  final n = int.tryParse(id);
  if (n != null && n >= 1 && n <= 15) {
    return 'assets/images/avatars-images/avatar$n.png';
  }

  return 'assets/images/avatars-images/avatar1.png';
}
