import 'package:flutter/material.dart';
import 'package:light_client/config/asset_constants.dart';
import 'package:light_client/services/currency_service.dart';
import 'package:provider/provider.dart';

class CharacterData {
  final int avatar;
  final Map<String, Map<String, dynamic>> attributes;

  CharacterData({required this.avatar, required this.attributes});
}

const Map<int, String> _specialAvatarUnlocks = {
  13: 'chat_astral',
  14: 'chien_gardien',
  15: 'lapin_lunaire',
};

const Map<String, int> _defaultValues = {'hp': 4, 'spd': 4, 'atk': 4, 'def': 4};

const Map<String, String> _translations = {
  'hp': 'Vie',
  'spd': 'Rapidit\u00e9',
  'atk': 'Attaque',
  'def': 'D\u00e9fense',
};

const Map<String, String> _tooltips = {
  'hp': 'Cet attribut est le nombre de points de vie de votre personnage.',
  'spd':
      "Cet attribut sert \u00e0 d\u00e9terminer l'ordre des tours. Il s'agit aussi des points de mouvement par tour de votre personnage.",
  'atk':
      "Cet attribut repr\u00e9sente la force avec laquelle une attaque est faite sur l\u2019adversaire.",
  'def':
      "Cet attribut repr\u00e9sente la capacit\u00e9 \u00e0 bloquer l\u2019attaque d\u2019un adversaire.",
};

// Warm colour palette matching the Angular SCSS
const Color _bgTan = Color(0xFFF8D0AF); // rgb(248, 208, 175)
const Color _brown = Color(0xFF744316);
const Color _headerOrange = Color(0xFFE7A76A);
const Color _greenSelected = Color(0xFFAAEC6D); // rgb(170, 236, 109)
const Color _greenBonus = Color(0xFF98E26C);
const Color _greenBonusHover = Color(0xFF5BC746);
const Color _brownDice = Color(0xFFAC794A);
const Color _greenSubmit = Color(0xFF58DD23);
const Color _redRequired = Color(0xFFF30C0C);

class CharacterFormDialog extends StatefulWidget {
  final List<int> unavailableAvatars;

  const CharacterFormDialog({super.key, this.unavailableAvatars = const []});

  @override
  State<CharacterFormDialog> createState() => _CharacterFormDialogState();
}

class _CharacterFormDialogState extends State<CharacterFormDialog> {
  int? _selectedAvatar;
  bool _walletLoaded = false;
  Set<String> _ownedCosmetics = {};

  int _hp = 4;
  int _spd = 4;
  final int _atk = 4;
  final int _def = 4;

  String? _bonusApplied;
  String? _diceD6On;

  bool get _isFormValid =>
      _selectedAvatar != null && _bonusApplied != null && _diceD6On != null;

  @override
  void initState() {
    super.initState();
    _loadOwnedCosmetics();
  }

  Future<void> _loadOwnedCosmetics() async {
    final currency = context.read<CurrencyService>();
    await currency.refreshWallet();
    if (!mounted) return;

    final owned = <String>{
      ...currency.wallet.ownedCharacters,
      ...currency.wallet.ownedVisuals,
    };

    setState(() {
      _ownedCosmetics = owned;
      _walletLoaded = true;
    });
  }

  bool _isSpecialAvatarLocked(int avatarIndex) {
    final unlockItem = _specialAvatarUnlocks[avatarIndex];
    if (unlockItem == null) return false;
    return !_ownedCosmetics.contains(unlockItem);
  }

  void _selectAvatar(int index) {
    if (widget.unavailableAvatars.contains(index) ||
        _isSpecialAvatarLocked(index)) {
      return;
    }
    setState(() => _selectedAvatar = index);
  }

  void _applyBonus(String type) {
    setState(() {
      if (_bonusApplied == type) return;

      if (_bonusApplied == 'hp') _hp = _defaultValues['hp']!;
      if (_bonusApplied == 'spd') _spd = _defaultValues['spd']!;

      _bonusApplied = type;
      if (type == 'hp') _hp = _defaultValues['hp']! + 2;
      if (type == 'spd') _spd = _defaultValues['spd']! + 2;
    });
  }

  void _assignDice(String attribute) {
    setState(() => _diceD6On = attribute);
  }

  int _diceFor(String attribute) {
    if (_diceD6On == null) return 4;
    if (attribute == 'atk') return _diceD6On == 'atk' ? 6 : 4;
    if (attribute == 'def') return _diceD6On == 'def' ? 6 : 4;
    return 4;
  }

  int _valueFor(String attribute) {
    switch (attribute) {
      case 'hp':
        return _hp;
      case 'spd':
        return _spd;
      case 'atk':
        return _atk;
      case 'def':
        return _def;
      default:
        return 4;
    }
  }

  void _submit() {
    if (!_isFormValid) return;

    final attributes = <String, Map<String, dynamic>>{
      'hp': {'value': _hp, 'dice': null},
      'spd': {'value': _spd, 'dice': null},
      'atk': {'value': _atk, 'dice': _diceFor('atk')},
      'def': {'value': _def, 'dice': _diceFor('def')},
    };

    Navigator.of(
      context,
    ).pop(CharacterData(avatar: _selectedAvatar!, attributes: attributes));
  }

  void _confirmClose() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => _ConfirmationPopup(
        message:
            '\u00cates-vous s\u00fbr de vouloir fermer le formulaire ? Une fois sorti, vos donn\u00e9es seront perdues.',
      ),
    );
    if (confirm == true && mounted) {
      Navigator.of(context).pop(null);
    }
  }

  Future<void> _confirmSubmit() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => const _ConfirmationPopup(
        message: '\u00cates-vous s\u00fbr de vouloir cr\u00e9er ce personnage ?',
      ),
    );
    if (confirm == true && mounted) {
      _submit();
    }
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Dialog.fullscreen(
      child: Scaffold(
        backgroundColor: _bgTan,
        body: SafeArea(
          child: Stack(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                child: Column(
                  children: [
                    _buildHeader(),
                    const SizedBox(height: 16),
                    Expanded(child: _buildFormLayout()),
                  ],
                ),
              ),
              // Close button
              Positioned(
                top: 8,
                right: 8,
                child: IconButton(
                  icon: const Icon(
                    Icons.close,
                    color: Colors.black87,
                    size: 28,
                  ),
                  onPressed: _confirmClose,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: const [
        Text(
          'Cr\u00e9er votre personnage',
          style: TextStyle(
            color: Colors.black,
            fontSize: 22,
            fontWeight: FontWeight.bold,
            fontFamily: 'TextFont',
          ),
        ),
        SizedBox(height: 4),
        Text(
          'Choisissez un avatar et personnalisez vos attributs pour commencer la partie',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.black87, fontSize: 14),
        ),
      ],
    );
  }

  Widget _buildFormLayout() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left section — avatars (flex: 2)
        Expanded(flex: 2, child: _buildAvatarSection()),
        const SizedBox(width: 40),
        // Right section — attributes, bonus, dice, submit (flex: 1)
        Expanded(flex: 1, child: _buildAttributeSection()),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Avatar section
  // ---------------------------------------------------------------------------

  Widget _buildAvatarSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('Choisissez un avatar :', required_: true),
        const SizedBox(height: 12),
        Expanded(
          child: !_walletLoaded
              ? const Center(child: CircularProgressIndicator(color: _brown))
              : GridView.builder(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.2,
                  ),
                  itemCount: 15,
                  itemBuilder: (_, index) => _buildAvatarTile(index + 1),
                ),
        ),
      ],
    );
  }

  Widget _buildAvatarTile(int avatarIndex) {
    final isSelected = _selectedAvatar == avatarIndex;
    final isUnavailable = widget.unavailableAvatars.contains(avatarIndex);
    final isLocked = _isSpecialAvatarLocked(avatarIndex);
    final isBlocked = isUnavailable || isLocked;

    return GestureDetector(
      onTap: isBlocked ? null : () => _selectAvatar(avatarIndex),
      child: Opacity(
        opacity: isBlocked ? 0.5 : 1.0,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          transform: isSelected
              ? Matrix4.diagonal3Values(1.1, 1.1, 1.0)
              : Matrix4.identity(),
          transformAlignment: Alignment.center,
          decoration: BoxDecoration(
            color: isSelected ? _greenSelected : Colors.white,
            border: Border.all(
              color: isSelected ? _brown : Colors.black,
              width: isSelected ? 4 : 3,
            ),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (isBlocked)
                ColorFiltered(
                  colorFilter: const ColorFilter.mode(
                    Colors.grey,
                    BlendMode.saturation,
                  ),
                  child: _avatarImage(avatarIndex),
                )
              else
                _avatarImage(avatarIndex),
              if (isLocked && !isUnavailable)
                Positioned(
                  top: 4,
                  right: 6,
                  child: const Text(
                    '\uD83D\uDD12',
                    style: TextStyle(fontSize: 14),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _avatarImage(int avatarIndex) {
    return Center(
      child: FractionallySizedBox(
        widthFactor: 0.55,
        child: Image.asset(
          avatarAsset('$avatarIndex'),
          fit: BoxFit.contain,
          errorBuilder: (_, _, _) =>
              const Icon(Icons.person, color: Colors.black54, size: 32),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Attribute section (right side)
  // ---------------------------------------------------------------------------

  Widget _buildAttributeSection() {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildAttributesTable(),
          const SizedBox(height: 20),
          _buildBonusSection(),
          const SizedBox(height: 20),
          _buildDiceSection(),
          const SizedBox(height: 28),
          _buildSubmitButton(),
        ],
      ),
    );
  }

  Widget _buildAttributesTable() {
    const attrs = ['hp', 'spd', 'atk', 'def'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('Vos attributs :', required_: true),
        const SizedBox(height: 8),
        Table(
          border: TableBorder.all(color: _brown, width: 3),
          columnWidths: const {0: FlexColumnWidth(3), 1: FlexColumnWidth(1)},
          children: [
            // Header row
            TableRow(
              decoration: const BoxDecoration(color: _headerOrange),
              children: const [
                Padding(
                  padding: EdgeInsets.all(8),
                  child: Text(
                    'Attributs',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.black,
                    ),
                  ),
                ),
                Padding(
                  padding: EdgeInsets.all(8),
                  child: Text(
                    'Valeurs',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.black,
                    ),
                  ),
                ),
              ],
            ),
            // Data rows
            ...attrs.map((attr) {
              final val = _valueFor(attr);
              final defaultVal = _defaultValues[attr]!;
              final isIncreased = val > defaultVal;
              return TableRow(
                decoration: const BoxDecoration(color: Colors.white),
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 6,
                    ),
                    child: Tooltip(
                      message: _tooltips[attr] ?? '',
                      child: Text(
                        _translations[attr] ?? attr,
                        style: const TextStyle(color: Colors.black),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 6,
                    ),
                    child: Text(
                      '$val',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: isIncreased ? _redRequired : Colors.black,
                        fontWeight: isIncreased
                            ? FontWeight.bold
                            : FontWeight.normal,
                      ),
                    ),
                  ),
                ],
              );
            }),
          ],
        ),
      ],
    );
  }

  Widget _buildBonusSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('Choisissez un bonus :', required_: true),
        const SizedBox(height: 8),
        Row(
          children: [
            _buildBonusButton(
              label: '+2 Vie',
              isApplied: _bonusApplied == 'hp',
              onTap: () => _applyBonus('hp'),
            ),
            const SizedBox(width: 20),
            _buildBonusButton(
              label: '+2 Rapidit\u00e9',
              isApplied: _bonusApplied == 'spd',
              onTap: () => _applyBonus('spd'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildBonusButton({
    required String label,
    required bool isApplied,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: isApplied ? _greenBonusHover : _greenBonus,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
            if (isApplied) ...[
              const SizedBox(width: 6),
              const Text(
                '\u2714',
                style: TextStyle(color: Colors.black, fontSize: 14),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDiceSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle('Assignation des d\u00e9s :', required_: true),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: _brown,
            borderRadius: BorderRadius.circular(3),
          ),
          child: const Text(
            "Choisissez o\u00f9 appliquer le d\u00e9 \u00e0 6 faces. L'autre attribut aura le d\u00e9 \u00e0 4 faces.",
            style: TextStyle(color: Colors.white, fontSize: 12),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            _buildDiceButton(label: 'Attaque', attribute: 'atk'),
            const SizedBox(width: 16),
            _buildDiceButton(label: 'D\u00e9fense', attribute: 'def'),
          ],
        ),
      ],
    );
  }

  Widget _buildDiceButton({required String label, required String attribute}) {
    final isSelected = _diceD6On == attribute;
    final diceValue = _diceD6On != null ? _diceFor(attribute) : null;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          onTap: () => _assignDice(attribute),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            decoration: BoxDecoration(
              color: _brownDice,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              label,
              style: const TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
        ),
        if (diceValue != null) ...[
          const SizedBox(width: 8),
          Image.asset(
            'assets/images/dice-$diceValue-faces.png',
            width: 25,
            height: 25,
            errorBuilder: (_, _, _) => Text(
              'D$diceValue',
              style: TextStyle(
                color: isSelected ? _brown : Colors.black54,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildSubmitButton() {
    return Center(
      child: GestureDetector(
        onTap: _isFormValid ? _confirmSubmit : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
          decoration: BoxDecoration(
            color: _isFormValid ? _greenSubmit : const Color(0xFFCCCCCC),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            "C'est parti !",
            style: TextStyle(
              color: _isFormValid ? Colors.black : const Color(0xFF666666),
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  Widget _sectionTitle(String text, {bool required_ = false}) {
    return RichText(
      text: TextSpan(
        text: text,
        style: const TextStyle(
          color: Colors.black,
          fontSize: 16,
          fontWeight: FontWeight.bold,
          fontFamily: 'TextFont',
        ),
        children: required_
            ? const [
                TextSpan(
                  text: ' *',
                  style: TextStyle(color: _redRequired),
                ),
              ]
            : null,
      ),
    );
  }
}

class _ConfirmationPopup extends StatelessWidget {
  final String message;

  const _ConfirmationPopup({required this.message});

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: Center(
        child: Container(
          width: 300,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 6,
                offset: Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.black, fontSize: 15),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _PopupImageButton(
                    asset: 'assets/images/buttons/yes-btn.png',
                    onTap: () => Navigator.pop(context, true),
                  ),
                  const SizedBox(width: 20),
                  _PopupImageButton(
                    asset: 'assets/images/buttons/no-btn.png',
                    onTap: () => Navigator.pop(context, false),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PopupImageButton extends StatefulWidget {
  final String asset;
  final VoidCallback onTap;

  const _PopupImageButton({required this.asset, required this.onTap});

  @override
  State<_PopupImageButton> createState() => _PopupImageButtonState();
}

class _PopupImageButtonState extends State<_PopupImageButton> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      child: MouseRegion(
        onEnter: (_) => setState(() => _hovered = true),
        onExit: (_) => setState(() => _hovered = false),
        child: AnimatedScale(
          scale: _hovered ? 1.1 : 1.0,
          duration: const Duration(milliseconds: 150),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(5),
            ),
            child: Image.asset(widget.asset, width: 40, height: 40),
          ),
        ),
      ),
    );
  }
}
