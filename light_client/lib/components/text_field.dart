import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class MyTextField extends StatelessWidget {
  final TextEditingController controller;
  final String hintText;
  final bool obscureText;

  const MyTextField({
    super.key,
    required this.controller,
    required this.hintText,
    required this.obscureText,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 50),
      child: TextField(
        maxLength: 255,
        maxLengthEnforcement: MaxLengthEnforcement.truncateAfterCompositionEnds,
        controller: controller,
        obscureText: obscureText,
        maxLines: obscureText ? 1 : 4,
        minLines: 1,
        textCapitalization: TextCapitalization.sentences,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          hintText: hintText,
          hintStyle: const TextStyle(color: Colors.white54),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 8,
            vertical: 8,
          ),
          counterStyle: const TextStyle(color: Colors.white),
        ),
      ),
    );
  }
}
