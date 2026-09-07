import 'package:flutter/material.dart';
import 'package:light_client/config/asset_constants.dart';
import 'package:light_client/models/game_models.dart';

class MapView extends StatelessWidget {
  final Map<String, dynamic> mapData;
  final List<Player> players;
  final Function(int x, int y) onTileClick;
  final Function(int x, int y)? onTileHover;
  final Function(int x, int y)? onTileLongPress;
  final List<Position> possibleMovements;
  final List<Position> shortestPath;

  const MapView({
    super.key,
    required this.mapData,
    required this.players,
    required this.onTileClick,
    this.onTileHover,
    this.onTileLongPress,
    this.possibleMovements = const [],
    this.shortestPath = const [],
  });

  @override
  Widget build(BuildContext context) {
    final int size = int.tryParse(mapData['size']?.toString() ?? '') ?? 10;

    final List<dynamic> tiles = mapData['tiles'] as List? ?? [];
    final List<dynamic> items = mapData['items'] as List? ?? [];

    return AspectRatio(
      aspectRatio: 1.0,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final double totalSize = constraints.maxWidth;
          final double cellSize = totalSize / size;

          return ClipRect(
            child: Stack(
              children: [
                GridView.builder(
                  padding: EdgeInsets.zero,
                  physics: const NeverScrollableScrollPhysics(),
                  shrinkWrap: true,
                  itemCount: size * size,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: size,
                    crossAxisSpacing: 0.0,
                    mainAxisSpacing: 0.0,
                  ),
                  itemBuilder: (context, index) {
                    final x = index % size;
                    final y = index ~/ size;

                    String tileType = 'empty';
                    if (y < tiles.length) {
                      final row = tiles[y];
                      if (row is List && x < row.length) {
                        tileType = row[x]?.toString() ?? 'empty';
                      }
                    }

                    String itemType = 'empty';
                    if (y < items.length) {
                      final row = items[y];
                      if (row is List && x < row.length) {
                        itemType = row[x]?.toString() ?? 'empty';
                      }
                    }

                    final playerOnTile = players.cast<Player?>().firstWhere(
                      (p) =>
                          p!.position.x == x &&
                          p.position.y == y &&
                          !p.isEliminated &&
                          !p.hasLeft,
                      orElse: () => null,
                    );

                    final bool isMovable = possibleMovements.any(
                      (pos) => pos.x == x && pos.y == y,
                    );

                    final bool isPath = shortestPath.any(
                      (pos) => pos.x == x && pos.y == y,
                    );

                    return MouseRegion(
                      onEnter: (_) => onTileHover?.call(x, y),
                      child: GestureDetector(
                        onTap: () => onTileClick(x, y),
                        onLongPress: onTileLongPress != null
                            ? () => onTileLongPress!(x, y)
                            : null,
                        child: _buildTile(
                          tileType,
                          itemType,
                          playerOnTile,
                          isMovable,
                          isPath,
                        ),
                      ),
                    );
                  },
                ),

                ...players
                    .where((p) => !p.hasLeft && !p.isEliminated)
                    .map(
                      (player) => Positioned(
                        key: ValueKey('player_${player.socketId}'),
                        left: player.position.x * cellSize,
                        top: player.position.y * cellSize,
                        width: cellSize,
                        height: cellSize,
                        child: IgnorePointer(
                          child: Center(
                            child: Image.asset(
                              avatarAsset(player.avatar),
                              width: cellSize * 0.7,
                              height: cellSize * 0.7,
                              fit: BoxFit.contain,
                              errorBuilder: (_, _, _) => CircleAvatar(
                                radius: cellSize * 0.3,
                                backgroundColor: Colors.white,
                                child: Text(
                                  player.name.isNotEmpty ? player.name[0] : '?',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildTile(
    String tileType,
    String itemType,
    Player? playerOnTile,
    bool isMovable,
    bool isPath,
  ) {
    final tileImage = tileAssets[tileType];

    return Stack(
      fit: StackFit.expand,
      children: [
        if (tileImage != null)
          Image.asset(tileImage, fit: BoxFit.cover)
        else
          Container(color: Colors.grey.shade300),

        if (isMovable && !isPath)
          Center(
            child: Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.grey, width: 2),
              ),
            ),
          ),

        if (isMovable && isPath)
          Center(
            child: Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: Colors.yellow,
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.yellowAccent.shade700,
                  width: 2,
                ),
              ),
            ),
          ),

        if (itemType != 'empty' && playerOnTile == null)
          Center(child: _buildItemWidget(itemType)),
      ],
    );
  }

  Widget _buildItemWidget(String itemType) {
    final path = itemAssets[itemType];
    if (path == null) {
      return Text(
        itemType[0].toUpperCase(),
        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
      );
    }
    return Opacity(
      opacity: 0.85,
      child: Image.asset(path, width: 20, height: 20, fit: BoxFit.contain),
    );
  }
}
