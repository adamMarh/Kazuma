import 'dart:async';
import 'package:flutter/material.dart';
import 'package:light_client/services/friend/friend_models.dart';
import 'package:light_client/services/friend/friend_service.dart';
import 'package:light_client/services/game_service.dart';
import 'package:light_client/components/status_indicator.dart';
import 'package:provider/provider.dart';

class FriendPanel extends StatefulWidget {
  const FriendPanel({super.key});

  @override
  State<FriendPanel> createState() => _FriendPanelState();
}

enum _FriendTab { friends, requests, search, blocked }

class _FriendPanelState extends State<FriendPanel> {
  bool _isOpen = false;
  _FriendTab _activeTab = _FriendTab.friends;

  final TextEditingController _searchController = TextEditingController();
  Timer? _searchDebounce;
  int _lastUsersUpdateRevision = 0;

  final Map<String, DateTime> _inviteCooldowns = {};
  Timer? _cooldownTimer;

  @override
  void initState() {
    super.initState();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_inviteCooldowns.isNotEmpty && mounted) {
        setState(() {
          _inviteCooldowns.removeWhere((key, time) => DateTime.now().isAfter(time));
        });
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final fs = context.read<FriendService>();
      _lastUsersUpdateRevision = fs.usersUpdateRevision;
      fs.addListener(_onFriendServiceChanged);
    });
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    context.read<FriendService>().removeListener(_onFriendServiceChanged);
    _searchController.dispose();
    _searchDebounce?.cancel();
    super.dispose();
  }

  void _onFriendServiceChanged() {
    final fs = context.read<FriendService>();
    if (fs.usersUpdateRevision != _lastUsersUpdateRevision) {
      _lastUsersUpdateRevision = fs.usersUpdateRevision;
      if (_activeTab == _FriendTab.search &&
          _searchController.text.trim().isNotEmpty) {
        _onSearchChanged(_searchController.text);
      }
    }
  }

  void _toggle() {
    setState(() {
      _isOpen = !_isOpen;
    });
    if (_isOpen) {
      final friendService = Provider.of<FriendService>(context, listen: false);
      friendService.loadFriends();
      friendService.loadPendingRequests();
    }
  }

  void _setTab(_FriendTab tab) {
    setState(() {
      _activeTab = tab;
      if (tab == _FriendTab.search) {
        _searchController.clear();
        Provider.of<FriendService>(context, listen: false).clearSearch();
      }
    });
  }

  void _onSearchChanged(String query) {
    Provider.of<FriendService>(context, listen: false).onSearchInput(query);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<FriendService>(
      builder: (context, friendService, _) {
        return Stack(
          children: [
            Positioned(
              bottom: 60,
              right: 20,
              child: _buildToggleButton(friendService.pendingCount),
            ),

            if (_isOpen)
              Positioned(
                bottom: 115,
                right: 20,
                child: _buildPanel(friendService),
              ),
          ],
        );
      },
    );
  }

  Widget _buildToggleButton(int pendingCount) {
    return GestureDetector(
      onTap: _toggle,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF26A85A),
          borderRadius: BorderRadius.circular(25),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.4),
              blurRadius: 15,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Amis',
              style: TextStyle(
                color: Color(0xFF00210B),
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (pendingCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                width: 22,
                height: 22,
                decoration: const BoxDecoration(
                  color: Color(0xFFE74C3C),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  '$pendingCount',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPanel(FriendService friendService) {
    return Container(
      width: 360,
      constraints: const BoxConstraints(maxHeight: 480),
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildHeader(),
          if (friendService.errorMessage != null)
            _buildErrorBanner(friendService.errorMessage!),
          _buildTabs(friendService.pendingCount),
          Flexible(child: _buildTabContent(friendService)),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0x08FFFFFF), width: 1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            'Amis',
            style: TextStyle(
              color: Color(0xFFC8FFD1),
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          GestureDetector(
            onTap: _toggle,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(4)),
              child: Text(
                'X',
                style: TextStyle(
                  color: const Color(0xFFE6FFE6).withValues(alpha: 0.7),
                  fontSize: 18,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorBanner(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFE74C3C).withValues(alpha: 0.2),
        border: Border.all(
          color: const Color(0xFFE74C3C).withValues(alpha: 0.4),
        ),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(color: Color(0xFFE74C3C), fontSize: 13),
      ),
    );
  }

  Widget _buildTabs(int pendingCount) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0x08FFFFFF), width: 1)),
      ),
      child: Row(
        children: [
          _buildTab(
            'Amis (${Provider.of<FriendService>(context, listen: false).friends.length})',
            _FriendTab.friends,
          ),
          _buildRequestsTab(pendingCount),
          _buildTab('Rechercher', _FriendTab.search),
          _buildTab('Bloqués', _FriendTab.blocked),
        ],
      ),
    );
  }

  Widget _buildTab(String label, _FriendTab tab) {
    final isActive = _activeTab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: () => _setTab(tab),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isActive ? const Color(0xFF26A85A) : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          alignment: Alignment.center,
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              label,
              maxLines: 1,
              style: TextStyle(
                color: isActive
                    ? const Color(0xFF26A85A)
                    : const Color(0xFFE6FFE6).withValues(alpha: 0.5),
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRequestsTab(int pendingCount) {
    final isActive = _activeTab == _FriendTab.requests;
    return Expanded(
      child: GestureDetector(
        onTap: () => _setTab(_FriendTab.requests),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isActive ? const Color(0xFF26A85A) : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          alignment: Alignment.center,
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Demandes',
                  style: TextStyle(
                    color: isActive
                        ? const Color(0xFF26A85A)
                        : const Color(0xFFE6FFE6).withValues(alpha: 0.5),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (pendingCount > 0) ...[
                  const SizedBox(width: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 1,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE74C3C),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '$pendingCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTabContent(FriendService friendService) {
    switch (_activeTab) {
      case _FriendTab.friends:
        return _buildFriendsList(friendService);
      case _FriendTab.requests:
        return _buildRequestsList(friendService);
      case _FriendTab.search:
        return _buildSearchSection(friendService);
      case _FriendTab.blocked:
        return _buildBlockedList(friendService);
    }
  }

  Widget _buildFriendsList(FriendService friendService) {
    final friends = friendService.friends;
    if (friends.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Aucun ami pour le moment.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0x80E6FFE6), fontSize: 14),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      shrinkWrap: true,
      itemCount: friends.length,
      itemBuilder: (context, index) {
        final friend = friends[index];
        return _buildFriendItem(friend, friendService);
      },
    );
  }

  Widget _buildFriendItem(FriendEntry friend, FriendService friendService) {
    return Consumer<GameService>(
      builder: (context, gameService, _) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    StatusIndicator(status: friend.userStatus, size: 10),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            friend.username,
                            style: const TextStyle(
                              color: Color(0xFFE6FFE6),
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            StatusIndicator.labelForStatus(friend.userStatus),
                            style: TextStyle(
                              color: StatusIndicator.colorForStatus(
                                friend.userStatus,
                              ),
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildInviteButton(friend, gameService, friendService),
                  _buildActionButton(
                    label: 'Retirer',
                    color: const Color(0xFFE74C3C),
                    onTap: () => friendService.removeFriend(friend.uid),
                  ),
                  const SizedBox(width: 6),
                  _buildActionButton(
                    label: '🚫',
                    color: const Color(0xFF9E9E9E),
                    onTap: () => friendService.blockUser(friend.uid),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildInviteButton(
    FriendEntry friend,
    GameService gameService,
    FriendService friendService,
  ) {
    if (gameService.currentGame?.isLocked == true) {
      return const SizedBox.shrink();
    }

    final isInGame = gameService.currentGameId != null;
    final canInvite = isInGame && friend.userStatus == UserStatus.online;

    if (!canInvite) {
      return const SizedBox.shrink();
    }

    final cooldownEnd = _inviteCooldowns[friend.uid];
    final isOnCooldown = cooldownEnd != null && DateTime.now().isBefore(cooldownEnd);

    if (isOnCooldown) {
      final remainingSeconds = cooldownEnd.difference(DateTime.now()).inSeconds;
      return Padding(
        padding: const EdgeInsets.only(right: 8.0),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: Colors.grey.withValues(alpha: 0.15),
            border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            '${remainingSeconds}s',
            style: const TextStyle(
              color: Colors.grey,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(right: 8.0),
      child: GestureDetector(
        onTap: () {
          setState(() {
            _inviteCooldowns[friend.uid] = DateTime.now().add(const Duration(seconds: 15));
          });
          friendService.inviteFriendToGame(friend.uid, gameService.currentGameId!);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFFFD700), Color(0xFFDAA520)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(6),
          ),
          child: const Text(
            'Inviter',
            style: TextStyle(
              color: Colors.black87,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRequestsList(FriendService friendService) {
    final requests = friendService.pendingRequests;
    if (requests.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Aucune demande en attente.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0x80E6FFE6), fontSize: 14),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      shrinkWrap: true,
      itemCount: requests.length,
      itemBuilder: (context, index) {
        final request = requests[index];
        return _buildRequestItem(request, friendService);
      },
    );
  }

  Widget _buildRequestItem(FriendRequest request, FriendService friendService) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            request.fromUsername,
            style: const TextStyle(
              color: Color(0xFFE6FFE6),
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildActionButton(
                label: 'Accepter',
                color: const Color(0xFF26A85A),
                onTap: () => friendService.acceptRequest(request.id),
              ),
              const SizedBox(width: 6),
              _buildActionButton(
                label: 'Refuser',
                color: const Color(0xFFE74C3C),
                onTap: () => friendService.declineRequest(request.id),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSearchSection(FriendService friendService) {
    final searchResults = friendService.searchResults;
    final lastQuery = friendService.lastSearchQuery;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: TextField(
            controller: _searchController,
            onChanged: _onSearchChanged,
            textInputAction: TextInputAction.search,
            style: const TextStyle(color: Color(0xFFE6FFE6), fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Rechercher un joueur...',
              hintStyle: TextStyle(
                color: const Color(0xFFE6FFE6).withValues(alpha: 0.5),
              ),
              filled: true,
              fillColor: const Color(0x05FFFFFF),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: BorderSide(
                  color: const Color(0xFFFFFFFF).withValues(alpha: 0.06),
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: BorderSide(
                  color: const Color(0xFFFFFFFF).withValues(alpha: 0.06),
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: BorderSide(
                  color: const Color(0xFFC8FFC8).withValues(alpha: 0.25),
                ),
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 10,
              ),
              suffixIcon: IconButton(
                icon: const Icon(
                  Icons.search,
                  color: Color(0xFF26A85A),
                  size: 20,
                ),
                onPressed: () => _onSearchChanged(_searchController.text),
                tooltip: 'Rechercher',
              ),
            ),
          ),
        ),
        if (lastQuery.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              'Tapez un pseudo pour rechercher...',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: const Color(0xFFE6FFE6).withValues(alpha: 0.35),
                fontSize: 11,
              ),
            ),
          )
        else if (lastQuery.isNotEmpty && searchResults.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Aucun joueur trouvé.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0x80E6FFE6), fontSize: 14),
            ),
          )
        else
          Flexible(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 4),
              shrinkWrap: true,
              itemCount: searchResults.length,
              itemBuilder: (context, index) {
                final user = searchResults[index];
                return _buildSearchItem(user, friendService);
              },
            ),
          ),
      ],
    );
  }

  Widget _buildSearchItem(UserProfile user, FriendService friendService) {
    final alreadySent = friendService.isRequestSent(user.uid);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              user.username,
              style: const TextStyle(
                color: Color(0xFFE6FFE6),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (alreadySent)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0x0DFFFFFF),
                    border: Border.all(color: const Color(0x1AFFFFFF)),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'Envoyée',
                    style: TextStyle(
                      color: const Color(0xFFE6FFE6).withValues(alpha: 0.4),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                )
              else
                _buildActionButton(
                  label: 'Ajouter',
                  color: const Color(0xFF26A85A),
                  onTap: () => friendService.sendFriendRequest(user.uid),
                ),
              const SizedBox(width: 6),
              _buildActionButton(
                label: '🚫',
                color: const Color(0xFF9E9E9E),
                onTap: () => friendService.blockUser(user.uid),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBlockedList(FriendService friendService) {
    final blocked = friendService.blockedUsers;
    if (blocked.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Aucun utilisateur bloqué.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0x80E6FFE6), fontSize: 14),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      shrinkWrap: true,
      itemCount: blocked.length,
      itemBuilder: (context, index) {
        final user = blocked[index];
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  user.username,
                  style: const TextStyle(
                    color: Color(0xFFE6FFE6),
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              _buildActionButton(
                label: 'Débloquer',
                color: const Color(0xFF3498DB),
                onTap: () => friendService.unblockUser(user.uid),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildActionButton({
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          border: Border.all(color: color.withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}
