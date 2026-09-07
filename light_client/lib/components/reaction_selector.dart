import 'package:flutter/material.dart';
import 'package:light_client/services/chat/chat_service.dart';
import 'package:provider/provider.dart';

class ReactionSelector extends StatelessWidget {
  const ReactionSelector({super.key});

  @override
  Widget build(BuildContext context) {
    final chatService = Provider.of<ChatService>(context);
    return PopupMenuButton<String>(
      icon: Text(
        chatService.selectedReaction,
        style: const TextStyle(fontSize: 24, color: Colors.white),
      ),
      onSelected: (String emoji) {
        chatService.selectedReaction = emoji;
      },
      itemBuilder: (BuildContext context) {
        return chatService.reactions.map((String emoji) {
          return PopupMenuItem<String>(
            value: emoji,
            child: Text(emoji, style: const TextStyle(fontSize: 24)),
          );
        }).toList();
      },
    );
  }
}
