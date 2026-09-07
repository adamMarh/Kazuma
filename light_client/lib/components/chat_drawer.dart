import 'package:flutter/material.dart';
import 'package:light_client/components/chat_room.dart';

/// ChatDrawer is a layout wrapper that provides the drawer UI container.
/// All chat logic is handled by ChatRoom component to ensure uniform chat behavior.
class ChatDrawer extends StatelessWidget {
  const ChatDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: Colors.transparent,
      elevation: 0,
      width: MediaQuery.of(context).size.width * 0.85,
      child: Container(
        margin: EdgeInsets.only(
          top:
              AppBar().preferredSize.height +
              MediaQuery.of(context).padding.top,
          bottom: 10 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: const ChatRoom(gameId: 'global', isGlobalOnly: true),
      ),
    );
  }
}
