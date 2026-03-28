import { useState, useEffect, useRef } from 'react';

interface Attributes {
  precision: number;
  reflex: number;
  agility: number;
  decision: number;
  coldBlood: number;
  communication: number;
}

type Role = 'Sniper' | 'Entry Fragger' | 'Support' | 'Lurker' | 'IGL';
type WeaponCategory = 'Primary' | 'Secondary' | 'Grenade' | 'Utility';

interface Weapon {
  id: string;
  name: string;
  category: WeaponCategory;
  price: number;
  damage: number;
  precision: number;
  fireRate: number;
  description: string;
  range: number; // Distância máxima de alcance
  fov: number;   // Ângulo de visão em radianos
}

interface RobotState {
  hp: number;
  position: { x: number; y: number };
  angle: number;
  inventory: {
    primary?: Weapon;
    secondary: Weapon;
    grenades: string[];
    hasArmor: boolean;
    hasHelmet: boolean;
    hasDefuseKit: boolean;
  };
  currentAction: 'Idle' | 'Moving' | 'Combat' | 'Planting' | 'Defusing' | 'TacticalPause';
}

// --- ROBOT CLASS ---
type TeamSide = 'T' | 'CT';

type MapZone = {
  id: 'site-a' | 'site-b' | 'spawn-t' | 'spawn-ct';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'site' | 'spawn';
  team?: TeamSide;
};

type BombState = {
  isPlanted: boolean;
  isDropped: boolean;
  siteId?: 'site-a' | 'site-b';
  plantedAt?: number;
  position?: { x: number; y: number };
};

type SoundEvent = { x: number; y: number; type: 'step' | 'gunshot' | 'bomb'; team: TeamSide; time: number };

type LastEnemyPos = { CT?: { x: number; y: number }; T?: { x: number; y: number } };

type Waypoint = { id: string; x: number; y: number };
type PathPoint = { x: number; y: number; id?: string };

class Robot {
  public id: string;
  public name: string;
  public team: TeamSide;
  public attributes: Attributes;
  public role: Role;
  public state: RobotState;
  public targetPoint: { x: number; y: number } | null = null;
  public currentPath: { x: number; y: number }[] = [];
  public money: number = 800;
  public hasBomb: boolean = false;
  public plantingUntil?: number;
  public defusingUntil?: number;
  public isWalking: boolean = false;
  public kills: number = 0;
  public assists: number = 0;
  public deaths: number = 0;
  public damageDealtBy: Map<string, number> = new Map(); 
  public lastFiredTime: number = 0;
  public lastDamageTime: number = 0;
  public lastDamageSourcePos?: { x: number; y: number };
  public heardSoundPos?: { x: number; y: number };
  public heardSoundType?: 'step' | 'gunshot' | 'bomb';
  public heardSoundTime: number = 0;
  public lastDecisionTime: number = 0;
  public waitingSince: number = 0;
  public lastPos: { x: number; y: number } = { x: 0, y: 0 };
  public stuckTime: number = 0;
  public decisionCooldown: number = 200; 
  public lookAtPoint: { x: number; y: number } | null = null;

  constructor(
    id: string,
    name: string,
    team: TeamSide,
    attributes: Attributes,
    role: Role,
    initialPos: { x: number; y: number },
    defaultSecondary: Weapon
  ) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.attributes = attributes;
    this.role = role;
    this.state = {
      hp: 100,
      position: { ...initialPos },
      angle: 0,
      inventory: {
        secondary: defaultSecondary,
        grenades: [],
        hasArmor: true,
        hasHelmet: true,
        hasDefuseKit: team === 'CT',
      },
      currentAction: 'Idle',
    };
    this.setRandomTarget();
  }

  public setRandomTarget() {
    this.targetPoint = {
      x: 50 + Math.random() * 700,
      y: 50 + Math.random() * 500
    };
  }

  public getReactionTime(): number {
    let baseReflex = 400 - (this.attributes.reflex * 2.5);
    if (this.role === 'Sniper' || this.role === 'Entry Fragger') baseReflex *= 0.9;
    return Math.max(150, baseReflex);
  }

  public getFinalPrecision(): number {
    const currentWeapon = this.state.inventory.primary || this.state.inventory.secondary;
    let precisionFactor = (this.attributes.precision * 0.7 + currentWeapon.precision * 0.3) / 100;
    if (this.role === 'Sniper' && currentWeapon.id === 'AWP') precisionFactor *= 1.2;
    return Math.min(1, precisionFactor);
  }

  public moveTowardsLimited(targetX: number, targetY: number, maxStep: number, otherRobots: Robot[], lookAtTarget: boolean = true) {
    if (this.state.currentAction === 'Planting' || this.state.currentAction === 'Defusing') return;
    
    // Detecção de "travado" (stuck)
    const distMoved = Math.hypot(this.state.position.x - this.lastPos.x, this.state.position.y - this.lastPos.y);
    if (distMoved < 0.2) {
      this.stuckTime += 16;
    } else {
      this.stuckTime = 0;
    }
    this.lastPos = { ...this.state.position };

    // Se estiver travado por mais de 2 segundos, recalcula o caminho
    if (this.stuckTime > 2000 && this.targetPoint) {
      this.currentPath = findWaypointPath(this.state.position, this.targetPoint);
      this.stuckTime = 0;
    }

    let currentTargetX = targetX;
    let currentTargetY = targetY;

    // Se temos um caminho planejado
    if (this.currentPath.length > 0) {
      const nextPoint = this.currentPath[0];
      const distToNext = Math.hypot(this.state.position.x - nextPoint.x, this.state.position.y - nextPoint.y);
      
      // Aumentamos a tolerância para 35px para curvas mais suaves (Look-ahead)
      if (distToNext < 35) {
        this.currentPath.shift();
        if (this.currentPath.length > 0) {
          currentTargetX = this.currentPath[0].x;
          currentTargetY = this.currentPath[0].y;
        }
      } else {
        currentTargetX = nextPoint.x;
        currentTargetY = nextPoint.y;
      }
    }

    const dx = currentTargetX - this.state.position.x;
    const dy = currentTargetY - this.state.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 2) {
      let moveAngle = Math.atan2(dy, dx);
      
      // --- SISTEMA DE EVASÃO DE PAREDES (ANT-STUCK) ---
      const rays = [0, -0.6, 0.6]; 
      const rayDist = 45; // Aumentado para detectar quinas ainda mais cedo

      for (const rayAngle of rays) {
        const checkAngle = moveAngle + rayAngle;
        const rx = this.state.position.x + Math.cos(checkAngle) * rayDist;
        const ry = this.state.position.y + Math.sin(checkAngle) * rayDist;
        
        if (checkWallCollision(rx, ry, 16)) { 
          // Desvia com mais força e aplica uma pequena força lateral imediata
          const deviation = rayAngle === 0 ? (Math.random() > 0.5 ? 1 : -1) : -Math.sign(rayAngle);
          moveAngle += deviation * 1.2;
          
          // Força lateral de repulsão imediata para tirar da quina
          const sideAngle = moveAngle + Math.PI / 2 * deviation;
          this.state.position.x += Math.cos(sideAngle) * 2;
          this.state.position.y += Math.sin(sideAngle) * 2;
          break; 
        }
      }

      // Se estiver travado por mais de 1 segundo (stuck), tenta um "salto" lateral aleatório mais agressivo
      if (this.stuckTime > 1000 && distance > 5) {
        const escapeAngle = moveAngle + (Math.random() - 0.5) * Math.PI;
        this.state.position.x += Math.cos(escapeAngle) * 5;
        this.state.position.y += Math.sin(escapeAngle) * 5;
        this.stuckTime = 0; // Reset imediato após o pulo de escape
      }

      // --- COLISÃO SOFT ENTRE JOGADORES (SEPARAÇÃO) ---
      // Em vez de travar, aplica uma força suave para se afastarem
      otherRobots.forEach(r => {
        if (r.id !== this.id && r.state.hp > 0) {
          const dist = Math.hypot(this.state.position.x - r.state.position.x, this.state.position.y - r.state.position.y);
          if (dist < 25) { // Raio de conforto pessoal
            const pushAngle = Math.atan2(this.state.position.y - r.state.position.y, this.state.position.x - r.state.position.x);
            const pushForce = (25 - dist) * 0.15; // Quanto mais perto, mais forte o empurrão
            this.state.position.x += Math.cos(pushAngle) * pushForce;
            this.state.position.y += Math.sin(pushAngle) * pushForce;
          }
        }
      });

      if (lookAtTarget) {
        let finalLookAngle = moveAngle;
        if (this.lookAtPoint) {
          finalLookAngle = Math.atan2(this.lookAtPoint.y - this.state.position.y, this.lookAtPoint.x - this.state.position.x);
        }
        this.rotateTowards(finalLookAngle, 0.15);
      }
      
      const step = Math.min(distance, maxStep);
      const nextX = this.state.position.x + Math.cos(moveAngle) * step;
      const nextY = this.state.position.y + Math.sin(moveAngle) * step;

      // Movimentação com verificação de parede (colisão rígida apenas com o mapa)
      if (!checkWallCollision(nextX, this.state.position.y, 10)) {
        this.state.position.x = nextX;
      }
      if (!checkWallCollision(this.state.position.x, nextY, 10)) {
        this.state.position.y = nextY;
      }
      
      this.state.currentAction = 'Moving';
    } else {
      this.state.currentAction = 'Idle';
    }
  }

  public rotateTowards(targetAngle: number, step: number) {
    let diff = targetAngle - this.state.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    
    // Se estiver em combate ou reagindo a som/dano, rotaciona 2x mais rápido
    const isHighPriority = this.state.currentAction === 'Combat' || (Date.now() - this.lastDamageTime < 1500);
    const finalStep = isHighPriority ? step * 2.5 : step;

    if (Math.abs(diff) < finalStep) {
      this.state.angle = targetAngle;
    } else {
      this.state.angle += Math.sign(diff) * finalStep;
    }
  }

  public canSee(target: Robot): boolean {
    const dx = target.state.position.x - this.state.position.x;
    const dy = target.state.position.y - this.state.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const currentWeapon = this.state.inventory.primary || this.state.inventory.secondary;
    
    if (distance > currentWeapon.range) return false;
    
    // Bloqueio por parede (Line of Sight)
    if (lineIntersectsWall(this.state.position, target.state.position)) return false;

    const angleToTarget = Math.atan2(dy, dx);
    let diff = angleToTarget - this.state.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return Math.abs(diff) < (currentWeapon.fov / 2); 
  }

  public takeDamage(amount: number, attackerId?: string, attackerPos?: { x: number; y: number }, onDeath?: (robot: Robot) => void) {
    if (attackerId) {
      const current = this.damageDealtBy.get(attackerId) || 0;
      this.damageDealtBy.set(attackerId, current + amount);
      if (attackerPos) {
        this.lastDamageSourcePos = { ...attackerPos };
        this.lastDamageTime = Date.now();
        // Reação IMEDIATA ao dano: virar para o agressor, mesmo sem decisão
        this.lookAtPoint = { ...attackerPos };
      }
    }
    this.state.hp = Math.max(0, this.state.hp - amount);

    // Se estava plantando ou desarmando, cancela ao levar dano
    this.plantingUntil = undefined;
    this.defusingUntil = undefined;

    if (this.state.hp <= 0) {
      this.deaths++;
      if (onDeath) onDeath(this);
    }
  }

  public hearSound(pos: { x: number; y: number }, type: 'step' | 'gunshot' | 'bomb') {
    const dx = pos.x - this.state.position.x;
    const dy = pos.y - this.state.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDist = type === 'step' ? 120 : (type === 'gunshot' ? 600 : 500);
    
    if (distance <= maxDist) {
      // Prioridade: se for um tiro, substitui sons de passos anteriores mesmo se o tempo for similar
      const isNewer = Date.now() - this.heardSoundTime > 500;
      const isPriority = type === 'gunshot' && this.heardSoundType !== 'gunshot';
      
      if (isNewer || isPriority) {
        this.heardSoundPos = { ...pos };
        this.heardSoundType = type;
        this.heardSoundTime = Date.now();
      }
    }
  }

  // --- BRAIN: ROLE-BASED DECISION MAKING ---
  public updateDecision(
    now: number, 
    teamAlive: number, 
    enemiesAlive: number, 
    roundTime: number, 
    bombState: BombState, 
    targetSiteCenter: {x: number, y: number},
    redStrategy: 'rush' | 'split' | 'slow' | 'default',
    bluStrategy: 'default' | 'aggressive' | 'retake' | 'stack-a' | 'stack-b',
    siteA: MapZone,
    siteB: MapZone,
    otherRobots: Robot[],
    lastEnemyPos: LastEnemyPos
  ) {
    if (now - this.lastDecisionTime < this.decisionCooldown) return;
    this.lastDecisionTime = now;

    const isT = this.team === 'T';
    const hasBombOnFloor = bombState.isDropped && !!bombState.position;
    const isBombPlanted = bombState.isPlanted;

    // --- LOGICA DE SAVE (CT) ---
    if (!isT && isBombPlanted) {
      const hasGoodWeapon = this.state.inventory.primary !== undefined;
      const isOutnumbered = enemiesAlive >= teamAlive + 2 || (teamAlive === 1 && enemiesAlive >= 2);
      
      if (hasGoodWeapon && isOutnumbered) {
        this.setSmartTarget({ ...DUST2_MAP.spawnPoints.CT[0] });
        return;
      }
    }

    // --- LOGICA DE SAVE (T) ---
    if (isT && hasBombOnFloor && !isBombPlanted) {
      const hasGoodWeapon = this.state.inventory.primary !== undefined;
      const isOutnumbered = enemiesAlive >= teamAlive + 2 || (teamAlive === 1 && enemiesAlive >= 2);
      
      if (hasGoodWeapon && isOutnumbered) {
        this.setSmartTarget({ ...DUST2_MAP.spawnPoints.T[0] });
        return;
      }
    }

    // --- LOGICA DE ESTRATÉGIA DE TIME (T) ---
    if (isT && isBombPlanted) {
      const isWinningHard = teamAlive >= enemiesAlive + 2;
      const lastCT = lastEnemyPos.T;
      
      if (isWinningHard && lastCT) {
        this.setSmartTarget({ ...lastCT });
        return;
      } else {
        const pSite = bombState.siteId === 'site-a' ? siteA : siteB;
        const pCenter = getZoneCenter(pSite);
        if (!this.targetPoint || Math.hypot(this.state.position.x - this.targetPoint.x, this.state.position.y - this.targetPoint.y) < 20) {
          this.setSmartTarget({ x: pCenter.x + (Math.random()-0.5)*150, y: pCenter.y + (Math.random()-0.5)*150 });
        }
        return;
      }
    }

    // --- LÓGICA DE MOVIMENTAÇÃO (SHIFT VS RUN) ---
    // Padrão é andar devagar (isWalking = true) para não fazer barulho
    this.isWalking = true;

    // Situações em que o robô deve CORRER (isWalking = false):
    const isUnderAttack = (now - this.lastDamageTime < 2000);
    const allyInCombat = otherRobots.find(r => 
      r.team === this.team && 
      r.id !== this.id && 
      r.state.hp > 0 && 
      (r.state.currentAction === 'Combat' || now - r.lastDamageTime < 1500) && 
      Math.hypot(r.state.position.x - this.state.position.x, r.state.position.y - this.state.position.y) < (this.team === 'T' ? 350 : 400)
    );
    const isHelpingAlly = allyInCombat !== undefined;
    const isBombObjectiveUrgent = (isBombPlanted || (isT && this.hasBomb && Math.hypot(this.state.position.x - targetSiteCenter.x, this.state.position.y - targetSiteCenter.y) < 200));
    const isTimeUrgent = roundTime < 20000; // Menos de 20s para acabar o round

    if (isUnderAttack || isHelpingAlly || isBombObjectiveUrgent || isTimeUrgent || hasBombOnFloor) {
      this.isWalking = false;
    }

    // Se a estratégia for RUSH, os TRs correm desde o início
    if (isT && redStrategy === 'rush' && !isBombPlanted) {
      this.isWalking = false;
    }

    // --- LÓGICA DE MIRA (LOOK AT) ---
    // 1. Prioridade: Inimigo visível (Combat)
    const visibleEnemies = otherRobots.filter(r => r.team !== this.team && r.state.hp > 0 && this.canSee(r));
    if (visibleEnemies.length > 0) {
      const closest = visibleEnemies.reduce((prev, curr) => 
        Math.hypot(this.state.position.x - curr.state.position.x, this.state.position.y - curr.state.position.y) < 
        Math.hypot(this.state.position.x - prev.state.position.x, this.state.position.y - prev.state.position.y) ? curr : prev
      );
      this.lookAtPoint = closest.state.position;
    } 
    // 2. Prioridade: Levando dano (reagir à origem do tiro)
    else if (now - this.lastDamageTime < 1500 && this.lastDamageSourcePos) {
      this.lookAtPoint = this.lastDamageSourcePos;
    }
    // 3. Prioridade: Aliado próximo em combate ou tomando dano
    else if (allyInCombat) {
      this.lookAtPoint = allyInCombat.state.position;
    }
    // 4. Prioridade: Sons de tiros de inimigos
    else if (now - this.heardSoundTime < 1500 && this.heardSoundPos && this.heardSoundType === 'gunshot') {
      this.lookAtPoint = this.heardSoundPos;
    }
    // 5. Prioridade: Sons de passos de inimigos
    else if (now - this.heardSoundTime < 1000 && this.heardSoundPos && this.heardSoundType === 'step') {
      this.lookAtPoint = this.heardSoundPos;
    }
    // 6. Prioridade: Ponto de estratégia (Defesa de Site ou Pre-aiming) - Definido nas funções handleT/CTDecision

    // 2. LÓGICA PADRÃO POR ROLE
    if (isT) {
      this.handleTerroristDecision(hasBombOnFloor, isBombPlanted, bombState, targetSiteCenter, redStrategy, siteA, siteB, otherRobots, enemiesAlive, now, roundTime);
    } else {
      this.handleCTDecision(hasBombOnFloor, isBombPlanted, bombState, bluStrategy, siteA, siteB, otherRobots, now);
    }
  }

  private setSmartTarget(finalDest: {x: number, y: number}) {
    if (this.targetPoint && this.targetPoint.x === finalDest.x && this.targetPoint.y === finalDest.y) return;
    this.targetPoint = finalDest;
    this.currentPath = findWaypointPath(this.state.position, finalDest);
  }

  private handleTerroristDecision(hasBombOnFloor: boolean, isBombPlanted: boolean, bombState: BombState, targetSiteCenter: { x: number; y: number }, strategy: 'rush' | 'split' | 'slow' | 'default', siteA: MapZone, siteB: MapZone, otherRobots: Robot[], enemiesAlive: number, now: number, roundTime: number) {
    // 1. PRIORIDADE ABSOLUTA: RECUPERAR C4
    if (hasBombOnFloor && bombState.position) {
      const bombPos = bombState.position;
      const distToBomb = Math.hypot(this.state.position.x - bombPos.x, this.state.position.y - bombPos.y);
      const myTeammates = otherRobots.filter(r => r.team === 'T' && r.id !== this.id && r.state.hp > 0);
      const isClosestToBomb = !myTeammates.some(r => 
        Math.hypot(r.state.position.x - bombPos.x, r.state.position.y - bombPos.y) < distToBomb
      );

      // Se sou o mais próximo ou estou bem perto, vou pegar a bomba AGORA
      if (isClosestToBomb || distToBomb < 150) {
        this.isWalking = false; // Corre para a bomba
        this.setSmartTarget({ ...bombPos });
      } else {
        // Se não sou o mais próximo, vou para o site para dar cobertura
        this.setSmartTarget(targetSiteCenter);
      }
      return;
    }

    const targetSiteId = bombState.siteId || (targetSiteCenter.x > 400 ? 'site-a' : 'site-b');

    // 2. PRIORIDADE PORTADOR: EXECUTAR O SITE ALVO (PELAS ROTAS PRINCIPAIS)
    if (this.hasBomb) {
      const targetSite = targetSiteId === 'site-a' ? siteA : siteB;
      const distToSite = Math.hypot(this.state.position.x - targetSiteCenter.x, this.state.position.y - targetSiteCenter.y);

      if (isInsideZone(this.state.position, targetSite) || distToSite < 40) {
        // Chegou no site! Para de se mover e planta
        this.targetPoint = null; 
        this.currentPath = [];
        this.waitingSince = 0;
        // Pre-aiming: Enquanto planta, olha para a entrada mais provável dos CTs (Meio/Spawn)
        this.lookAtPoint = { x: 400, y: 150 }; 
      } else {
        // O portador escolhe a rota baseada na estratégia
        let routeNode = targetSiteCenter;
        if (targetSiteId === 'site-a') {
          routeNode = (strategy === 'rush' || strategy === 'slow') ? { x: 700, y: 150 } : { x: 600, y: 150 };
        } else {
          routeNode = { x: 100, y: 150 };
        }
        
        // Na EXECUÇÃO LENTA, só anda devagar se ainda não houveram mortes significativas e tem tempo
        const totalEnemies = 5;
        const enemiesKilled = totalEnemies - enemiesAlive;
        const shouldHurry = strategy === 'slow' && (enemiesKilled >= 1 || roundTime < 40000);
        
        if (strategy === 'slow' && !shouldHurry) {
          this.isWalking = true;
          this.setSmartTarget(routeNode);
        } else {
          this.isWalking = false;
          // Se for acelerar, vai direto para o centro do site para plantar logo
          this.setSmartTarget(targetSiteCenter);
        }

        // Pre-aiming: olha para o próximo ponto do caminho
        if (this.currentPath.length > 0) {
          this.lookAtPoint = this.currentPath[0];
        }
      }
      return;
    }

    // 3. AJUDAR ALIADO EM COMBATE (SE ESTIVER PERTO)
    const allyInCombatLocal = otherRobots.find(r => 
      r.team === 'T' && r.id !== this.id && r.state.hp > 0 && 
      (r.state.currentAction === 'Combat' || now - r.lastDamageTime < 1500) && 
      Math.hypot(r.state.position.x - this.state.position.x, r.state.position.y - this.state.position.y) < 300
    );

    if (allyInCombatLocal && !isBombPlanted) {
      this.isWalking = false;
      this.setSmartTarget({ ...allyInCombatLocal.state.position });
      return;
    }

    // 4. LÓGICA DE EXECUÇÃO DE SITE (DIVISÃO TÁTICA)
    const carrier = otherRobots.find(r => r.team === 'T' && r.hasBomb && r.state.hp > 0);
    if (!carrier) {
      this.setSmartTarget(targetSiteCenter);
      return;
    }

    const distToCarrier = Math.hypot(this.state.position.x - carrier.state.position.x, this.state.position.y - carrier.state.position.y);

    // Na EXECUÇÃO LENTA, aliados também aceleram se o carrier acelerar
    const totalEnemies = 5;
    const enemiesKilled = totalEnemies - enemiesAlive;
    const shouldHurry = strategy === 'slow' && (enemiesKilled >= 1 || roundTime < 40000);

    if (strategy === 'rush' || strategy === 'slow' || strategy === 'default') {
      // Seguir o carrier
      if (distToCarrier > 120) {
        if (strategy === 'rush' || shouldHurry) this.isWalking = false;
        this.setSmartTarget({ ...carrier.state.position });
        // Olha para o carrier ou para onde está indo
        this.lookAtPoint = this.currentPath[0] || carrier.state.position;
      } else {
        if (shouldHurry) this.isWalking = false;
        this.setSmartTarget(targetSiteCenter);
        this.lookAtPoint = targetSiteCenter;
      }
    } else if (strategy === 'split') {
      // No SPLIT, alguns vão por caminhos diferentes
      const isSplitter = this.role === 'Lurker' || this.role === 'Sniper';
      
      if (isSplitter) {
        // Splitters vão pelo "outro" caminho para flanquear
        const splitX = targetSiteId === 'site-a' ? 550 : 400;
        const distToSplitPoint = Math.hypot(this.state.position.x - splitX, this.state.position.y - 300);
        
        if (distToSplitPoint > 40) {
          this.setSmartTarget({ x: splitX, y: 300 });
          this.lookAtPoint = this.currentPath[0] || { x: splitX, y: 300 };
        } else {
          this.setSmartTarget(targetSiteCenter);
          this.lookAtPoint = targetSiteCenter;
        }
      } else {
        // Outros seguem o carrier
        if (distToCarrier > 120) {
          this.setSmartTarget({ ...carrier.state.position });
          this.lookAtPoint = this.currentPath[0] || carrier.state.position;
        } else {
          this.setSmartTarget(targetSiteCenter);
          this.lookAtPoint = targetSiteCenter;
        }
      }
    }
  }

  private handleCTDecision(hasBombOnFloor: boolean, isBombPlanted: boolean, bombState: BombState, strategy: 'default' | 'aggressive' | 'retake' | 'stack-a' | 'stack-b', siteA: MapZone, siteB: MapZone, otherRobots: Robot[], now: number) {
    // 1. AJUDAR ALIADO EM COMBATE
    const allyInCombatLocal = otherRobots.find(r => 
      r.team === 'CT' && 
      r.id !== this.id && 
      r.state.hp > 0 && 
      (r.state.currentAction === 'Combat' || now - r.lastDamageTime < 1500) && 
      Math.hypot(r.state.position.x - this.state.position.x, r.state.position.y - this.state.position.y) < 400
    );

    if (allyInCombatLocal) {
      this.isWalking = false;
      this.setSmartTarget({ ...allyInCombatLocal.state.position });
      this.lookAtPoint = allyInCombatLocal.state.position;
      return;
    }

    // 2. RETAKE SE BOMBA PLANTADA
    if (isBombPlanted) {
      this.isWalking = false;
      const pSite = bombState.siteId === 'site-a' ? siteA : siteB;
      const pCenter = getZoneCenter(pSite);
      this.setSmartTarget({ ...pCenter });
      // Se tiver caminho, olha para o próximo ponto (pre-aiming tático)
      // Caso contrário, olha para o centro do site
      this.lookAtPoint = this.currentPath.length > 0 ? this.currentPath[0] : pCenter;
      return;
    }

    // 3. RECUPERAR BOMBA NO CHÃO
    if (hasBombOnFloor && bombState.position) {
      this.isWalking = false;
      this.setSmartTarget({ ...bombState.position });
      this.lookAtPoint = bombState.position;
      return;
    }

    // 4. POSICIONAMENTO DEFENSIVO BASEADO NA ESTRATÉGIA
    const idx = Number(this.id.split('-')[1]);
    
    // Lógica de Stack: Se a estratégia for stack, todos os CTs vão para o mesmo site
    let isSiteA = idx < 3;
    if (strategy === 'stack-a') isSiteA = true;
    if (strategy === 'stack-b') isSiteA = false;

    const targetSite = isSiteA ? siteA : siteB;
    const center = getZoneCenter(targetSite);

    // Definir pontos de entrada táticos para olhar
    const entries = {
      siteA: [
        { x: 700, y: 350 }, // Fundo / Long
        { x: 550, y: 300 }, // Varanda / Short
        { x: 400, y: 150 }  // Meio / CT Spawn
      ],
      siteB: [
        { x: 100, y: 300 }, // Túneis / B-Tunnels
        { x: 400, y: 300 }  // Meio / Mid
      ]
    };

    if (strategy === 'aggressive') {
      // CTs avançam para os chokepoints
      this.isWalking = true;
      let chokePoint = { x: 400, y: 300 };
      let entryToWatch = { x: 400, y: 540 }; // T-Spawn default

      if (isSiteA) {
        if (idx === 1) { // Vai Fundo
          chokePoint = { x: 700, y: 350 };
          entryToWatch = { x: 700, y: 500 }; // T-Entry Long
        } else { // Vai Meio/Varanda
          chokePoint = { x: 500, y: 300 };
          entryToWatch = { x: 400, y: 450 }; // Mid Bottom
        }
      } else {
        if (idx === 4) { // Vai Túneis
          chokePoint = { x: 100, y: 300 };
          entryToWatch = { x: 100, y: 500 }; // Tunnels Entry
        } else { // Fica Meio
          chokePoint = { x: 350, y: 300 };
          entryToWatch = { x: 400, y: 450 }; // Mid Bottom
        }
      }

      this.setSmartTarget(chokePoint);
      
      // Se estiver se movendo, olha para o ponto de perigo (chokePoint ou entrada)
      const distToChoke = Math.hypot(this.state.position.x - chokePoint.x, this.state.position.y - chokePoint.y);
      if (distToChoke > 50) {
        // No caminho, olha para onde está indo mas com pre-aiming no próximo nó
        this.lookAtPoint = this.currentPath.length > 0 ? this.currentPath[0] : chokePoint;
      } else {
        // Chegou no chokepoint, foca 100% na entrada
        this.lookAtPoint = entryToWatch;
      }

    } else if (strategy === 'retake') {
      // CTs jogam bem recuados
      this.isWalking = true;
      const safePos = isSiteA ? { x: 750, y: 50 } : { x: 50, y: 50 };
      this.setSmartTarget(safePos);
      
      // Mira sempre para as entradas do site
      const siteEntries = isSiteA ? entries.siteA : entries.siteB;
      this.lookAtPoint = siteEntries[idx % siteEntries.length];
    } else {
      // Default ou Stack: Ficam dentro do site olhando para as entradas
      this.isWalking = true;
      if (!this.targetPoint || Math.hypot(this.state.position.x - this.targetPoint.x, this.state.position.y - this.targetPoint.y) < 50) {
        // Se for stack, espalha um pouco mais no site
        const spread = strategy.startsWith('stack') ? 160 : 120;
        this.setSmartTarget({ 
          x: center.x + (Math.random()-0.5)*spread, 
          y: center.y + (Math.random()-0.5)*spread 
        });
      }
      
      // Mira tática: escolhe uma entrada do site para vigiar
      const siteEntries = isSiteA ? entries.siteA : entries.siteB;
      this.lookAtPoint = siteEntries[idx % siteEntries.length];
      
      // Se estiver se movendo para o site, olha para o caminho (pre-aiming)
      if (this.currentPath.length > 0 && Math.hypot(this.state.position.x - center.x, this.state.position.y - center.y) > 100) {
        this.lookAtPoint = this.currentPath[0];
      }
    }
  }
}

// --- MAP DATA ---
const DUST2_MAP = {
  name: 'Dust 2 (Simplificado)',
  width: 800,
  height: 600,
  walls: [
    // Bordas externas
    { x: 0, y: 0, width: 800, height: 10 },
    { x: 0, y: 590, width: 800, height: 10 },
    { x: 0, y: 0, width: 10, height: 600 },
    { x: 790, y: 0, width: 10, height: 600 },

    // --- BLOCOS SIMPLIFICADOS (3 Grandes Corredores) ---
    // Bloco central superior (Divide B do Meio)
    { x: 150, y: 150, width: 150, height: 150 }, 
    
    // Bloco central inferior (Divide Meio do Fundo)
    { x: 450, y: 150, width: 150, height: 300 },

    // Bloco que separa Meio da Varanda
    { x: 150, y: 400, width: 150, height: 100 },
  ],
  zones: [
    { id: 'site-a', name: 'Site A', x: 650, y: 50, width: 100, height: 100, type: 'site' as const },
    { id: 'site-b', name: 'Site B', x: 50, y: 50, width: 100, height: 100, type: 'site' as const },
    { id: 'spawn-t', name: 'T Spawn', x: 300, y: 500, width: 200, height: 80, type: 'spawn' as const, team: 'T' as const },
    { id: 'spawn-ct', name: 'CT Spawn', x: 300, y: 20, width: 200, height: 80, type: 'spawn' as const, team: 'CT' as const },
  ],
  spawnPoints: {
    T: [{ x: 320, y: 540 }, { x: 360, y: 540 }, { x: 400, y: 540 }, { x: 440, y: 540 }, { x: 480, y: 540 }],
    CT: [{ x: 320, y: 60 }, { x: 360, y: 60 }, { x: 400, y: 60 }, { x: 440, y: 60 }, { x: 480, y: 60 }]
  },
  waypoints: [
    { id: 't-spawn', x: 400, y: 540 },
    { id: 'mid-bottom', x: 400, y: 450 },
    { id: 'mid-center', x: 400, y: 300 },
    { id: 'mid-top', x: 400, y: 150 },
    { id: 'ct-spawn', x: 400, y: 80 },
    
    // Rota B (Túneis / Escuro)
    { id: 'tunnels-entry', x: 100, y: 540 },
    { id: 'tunnels-mid', x: 80, y: 350 },
    { id: 'tunnels-exit', x: 100, y: 150 },
    { id: 'site-b', x: 100, y: 100 },
    
    // Rota A (Fundo / Long)
    { id: 'long-a-entry', x: 700, y: 540 },
    { id: 'long-a-corner', x: 720, y: 350 },
    { id: 'long-a-exit', x: 700, y: 150 },
    { id: 'site-a', x: 700, y: 100 },

    // Rota Varanda (Catwalk / Short)
    { id: 'catwalk-entry', x: 500, y: 400 },
    { id: 'catwalk-mid', x: 550, y: 250 },
    { id: 'short-a', x: 600, y: 150 },
  ],
  connections: [
    // Meio
    ['t-spawn', 'mid-bottom'], ['mid-bottom', 'mid-center'], ['mid-center', 'mid-top'], ['mid-top', 'ct-spawn'],
    
    // Túneis -> B
    ['t-spawn', 'tunnels-entry'], ['tunnels-entry', 'tunnels-mid'], ['tunnels-mid', 'tunnels-exit'], ['tunnels-exit', 'site-b'],
    
    // Fundo -> A
    ['t-spawn', 'long-a-entry'], ['long-a-entry', 'long-a-corner'], ['long-a-corner', 'long-a-exit'], ['long-a-exit', 'site-a'],
    
    // Varanda -> A
    ['mid-bottom', 'catwalk-entry'], ['catwalk-entry', 'catwalk-mid'], ['catwalk-mid', 'short-a'], ['short-a', 'site-a'],
    
    // Conexões CT
    ['ct-spawn', 'site-a'], ['ct-spawn', 'site-b'], ['ct-spawn', 'short-a'], ['ct-spawn', 'mid-top'],
  ]
};

const getZoneById = (id: MapZone['id']) => (DUST2_MAP.zones as MapZone[]).find(z => z.id === id)!;
const getZoneCenter = (z: { x: number; y: number; width: number; height: number }) => ({
  x: z.x + z.width / 2,
  y: z.y + z.height / 2,
});
const isInsideZone = (p: { x: number; y: number }, z: { x: number; y: number; width: number; height: number }) =>
  p.x >= z.x && p.x <= z.x + z.width && p.y >= z.y && p.y <= z.y + z.height;

const checkWallCollision = (x: number, y: number, radius: number) => {
  return DUST2_MAP.walls.some(w => 
    x + radius > w.x && x - radius < w.x + w.width &&
    y + radius > w.y && y - radius < w.y + w.height
  );
};

const lineIntersectsWall = (p1: {x: number, y: number}, p2: {x: number, y: number}) => {
  for (const w of DUST2_MAP.walls) {
    const left = w.x, right = w.x + w.width, top = w.y, bottom = w.y + w.height;
    
    // Aumentamos os passos para detectar paredes finas (passos a cada 15px)
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(distance / 15);
    
    for (let i = 1; i < steps; i++) {
      const checkX = p1.x + dx * (i / steps);
      const checkY = p1.y + dy * (i / steps);
      if (checkX >= left && checkX <= right && checkY >= top && checkY <= bottom) return true;
    }
  }
  return false;
};

const findWaypointPath = (start: {x: number, y: number}, end: {x: number, y: number}): PathPoint[] => {
  if (!lineIntersectsWall(start, end)) return [end];
  const startWaypoints = (DUST2_MAP.waypoints as Waypoint[]).filter(wp => !lineIntersectsWall(start, wp));
  const endWaypoints = (DUST2_MAP.waypoints as Waypoint[]).filter(wp => !lineIntersectsWall(end, wp));
  if (startWaypoints.length === 0 || endWaypoints.length === 0) return [end];
  let shortestPath: PathPoint[] | null = null;
  let minNodes = Infinity;
  for (const startWp of startWaypoints) {
    const queue: { id: string, path: PathPoint[] }[] = [{ id: startWp.id, path: [startWp] }];
    const visited = new Set([startWp.id]);
    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      if (endWaypoints.some(ewp => ewp.id === id)) {
        if (path.length < minNodes) {
          minNodes = path.length;
          shortestPath = [...path, end];
        }
        break;
      }
      const neighbors = (DUST2_MAP.connections as [string, string][])
        .filter(([a, b]) => a === id || b === id)
        .map(([a, b]) => a === id ? b : a);
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          const neighborWp = (DUST2_MAP.waypoints as Waypoint[]).find(w => w.id === neighborId)!;
          queue.push({ id: neighborId, path: [...path, neighborWp] });
        }
      }
    }
  }
  return shortestPath || [end];
};

const GameCanvas = ({ robots, bomb, sounds, showOverlay }: { robots: Robot[], bomb: BombState, sounds: SoundEvent[], showOverlay: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(10, 10, 780, 580);
    DUST2_MAP.walls.forEach(w => { 
      ctx.fillStyle = '#444'; 
      ctx.fillRect(w.x, w.y, w.width, w.height);
      ctx.strokeStyle = '#555';
      ctx.strokeRect(w.x, w.y, w.width, w.height);
    });
    DUST2_MAP.zones.forEach(z => {
      ctx.strokeStyle = z.type === 'site' ? '#f00' : '#00f';
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(z.x, z.y, z.width, z.height);
      ctx.setLineDash([]);
      ctx.fillStyle = z.type === 'site' ? 'rgba(255, 0, 0, 0.05)' : 'rgba(0, 0, 255, 0.05)';
      ctx.fillRect(z.x, z.y, z.width, z.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '12px Arial';
      ctx.fillText(z.name, z.x + 5, z.y + 15);
    });
    if (showOverlay) {
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
      ctx.lineWidth = 2;
      DUST2_MAP.connections.forEach(([startId, endId]) => {
        const start = DUST2_MAP.waypoints.find(wp => wp.id === startId);
        const end = DUST2_MAP.waypoints.find(wp => wp.id === endId);
        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
      });
      DUST2_MAP.waypoints.forEach(wp => {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(wp.id.toUpperCase(), wp.x, wp.y - 8);
      });
      robots.forEach(r => {
        if (r.state.hp > 0 && r.currentPath.length > 0) {
          ctx.strokeStyle = r.team === 'CT' ? 'rgba(30, 144, 255, 0.6)' : 'rgba(255, 140, 0, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(r.state.position.x, r.state.position.y);
          r.currentPath.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }
    
    // --- BOMB DRAWING ---
    if ((bomb.isPlanted || bomb.isDropped) && bomb.position) {
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (bomb.isDropped) {
        const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
        ctx.beginPath();
        ctx.arc(bomb.position.x, bomb.position.y, 15 + pulse * 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 0, ${0.1 + pulse * 0.2})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillText('💣', bomb.position.x, bomb.position.y);
      if (bomb.isPlanted) {
        const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
        ctx.beginPath();
        ctx.arc(bomb.position.x, bomb.position.y, 12 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 0, 0, ${0.2 + pulse * 0.3})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();
      }
    }
    sounds.forEach(s => {
      const age = Date.now() - s.time;
      const opacity = 1 - (age / 500);
      const radius = s.type === 'step' ? 10 + (age / 500) * 20 : 30 + (age / 500) * 100;
      ctx.beginPath();
      ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = s.team === 'T' ? `rgba(255, 140, 0, ${opacity * 0.3})` : `rgba(30, 144, 255, ${opacity * 0.3})`;
      ctx.stroke();
      ctx.closePath();
    });
    robots.forEach(r => {
      if (r.state.hp <= 0) return;
      const { x, y } = r.state.position;
      const currentWeapon = r.state.inventory.primary || r.state.inventory.secondary;
      const isFiring = Date.now() - r.lastFiredTime < 100;
      const flashAlpha = isFiring ? 0.3 : 0.04;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, currentWeapon.range, r.state.angle - currentWeapon.fov / 2, r.state.angle + currentWeapon.fov / 2);
      ctx.fillStyle = r.team === 'T' ? `rgba(255, 140, 0, ${flashAlpha})` : `rgba(30, 144, 255, ${flashAlpha})`;
      ctx.fill();
      ctx.closePath();
      const precisionAngle = (currentWeapon.fov * (1 - (r.getFinalPrecision() * 0.8)));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, currentWeapon.range, r.state.angle - precisionAngle / 2, r.state.angle + precisionAngle / 2);
      ctx.fillStyle = r.team === 'T' ? `rgba(255, 69, 0, ${isFiring ? 0.5 : 0.1})` : `rgba(0, 191, 255, ${isFiring ? 0.5 : 0.1})`;
      ctx.fill();
      ctx.closePath();
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = r.team === 'T' ? '#ff8c00' : '#1e90ff';
      ctx.fill();
      ctx.strokeStyle = r.state.currentAction === 'Combat' ? '#ff0000' : '#fff';
      ctx.lineWidth = r.state.currentAction === 'Combat' ? 3 : 1;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '10px Arial';
      ctx.fillText(`${r.name} (${Math.round(r.state.hp)})`, x, y - 15);
      if (r.hasBomb) { ctx.font = '12px Arial'; ctx.fillText('💣', x + 12, y - 12); }
      if (r.state.currentAction === 'Planting' && r.plantingUntil) {
        const total = 5000;
        const remaining = r.plantingUntil - Date.now();
        const progress = Math.max(0, Math.min(1, (total - remaining) / total));
        ctx.fillStyle = '#444';
        ctx.fillRect(x - 15, y + 15, 30, 4);
        ctx.fillStyle = '#ff8c00';
        ctx.fillRect(x - 15, y + 15, 30 * progress, 4);
      }
      if (r.state.currentAction === 'Defusing' && r.defusingUntil) {
        const total = r.state.inventory.hasDefuseKit ? 5000 : 10000;
        const remaining = r.defusingUntil - Date.now();
        const progress = Math.max(0, Math.min(1, (total - remaining) / total));
        ctx.fillStyle = '#444';
        ctx.fillRect(x - 15, y + 15, 30, 4);
        ctx.fillStyle = '#1e90ff';
        ctx.fillRect(x - 15, y + 15, 30 * progress, 4);
      }
    });
  };
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    let id: number;
    const render = () => { 
      try { draw(ctx); } catch (e) { console.error("Erro na renderização:", e); }
      id = requestAnimationFrame(render); 
    };
    render();
    return () => cancelAnimationFrame(id);
  }, [robots, bomb, sounds]);
  return <canvas ref={canvasRef} width={DUST2_MAP.width} height={DUST2_MAP.height} style={{ border: '2px solid #555' }} />;
};

const USP: Weapon = { id: 'usp', name: 'USP-S', category: 'Secondary', price: 0, damage: 25, precision: 85, fireRate: 3, description: 'CT', range: 150, fov: Math.PI / 2.5 };
const GLOCK: Weapon = { id: 'glock', name: 'Glock-18', category: 'Secondary', price: 0, damage: 20, precision: 75, fireRate: 4, description: 'T', range: 120, fov: Math.PI / 2.2 };
const MONEY_CAP = 16000;
const clampMoney = (money: number) => Math.min(MONEY_CAP, Math.max(0, Math.round(money)));
const SHOP = {
  rifle: { id: 'rifle', name: 'AK-47/M4A4', category: 'Primary' as WeaponCategory, price: 2700, damage: 35, precision: 75, fireRate: 6, description: 'Equilíbrio', range: 270, fov: Math.PI / 3 },
  smg:   { id: 'smg',   name: 'MAC-10/MP9',   category: 'Primary' as WeaponCategory, price: 1250, damage: 22, precision: 50, fireRate: 11, description: 'Econômica', range: 150, fov: Math.PI / 2 },
  sniper:{ id: 'AWP',   name: 'AWP',         category: 'Primary' as WeaponCategory, price: 4750, damage: 150, precision: 98, fireRate: 1, description: 'Longo Alcance', range: 420, fov: Math.PI / 8 },
};

const createInitialRobots = () => {
  const robots: Robot[] = [];
  const roles: Role[] = ['Sniper', 'Entry Fragger', 'Support', 'Lurker', 'IGL'];
  for (let i = 0; i < 5; i++) {
    // CT -> BLU
    robots.push(new Robot(`ct-${i}`, `BLU-${i+1}`, 'CT', { precision: 80, reflex: 80, agility: 80, decision: 80, coldBlood: 80, communication: 80 }, roles[i], DUST2_MAP.spawnPoints.CT[i], USP));
    // T -> RED
    robots.push(new Robot(`t-${i}`, `RED-${i+1}`, 'T', { precision: 80, reflex: 80, agility: 80, decision: 80, coldBlood: 80, communication: 80 }, roles[i], DUST2_MAP.spawnPoints.T[i], GLOCK));
  }
  const tBots = robots.filter(r => r.team === 'T');
  if (tBots.length > 0) tBots[0].hasBomb = true;
  return robots;
};

const RobotPanel = ({ team, robots, isSwapped, currentStrategy, bluStrategy, tsTargetSite }: { team: TeamSide; robots: Robot[]; isSwapped: boolean; currentStrategy: 'rush' | 'split' | 'slow' | 'default'; bluStrategy: 'default' | 'aggressive' | 'retake' | 'stack-a' | 'stack-b'; tsTargetSite: 'site-a' | 'site-b' }) => {
  const isRedTeam = isSwapped ? team === 'CT' : team === 'T';
  const teamName = isRedTeam ? 'RED TEAM' : 'BLU TEAM';
  const teamColor = isRedTeam ? '#ff8c00' : '#1e90ff';
  const teamBg = isRedTeam ? 'rgba(255,140,0,0.1)' : 'rgba(30,144,255,0.1)';

  return (
    <div style={{ width: 250, padding: 15, backgroundColor: teamBg, border: `1px solid ${teamColor}`, borderRadius: 8 }}>
      <h3 style={{ color: teamColor, textAlign: 'center', marginBottom: 5 }}>{teamName}</h3>
      <div style={{ fontSize: 10, color: teamColor, textAlign: 'center', marginBottom: 15, fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: 4, border: `1px solid ${isRedTeam ? 'rgba(255,140,0,0.2)' : 'rgba(30,144,255,0.2)'}` }}>
        {team === 'T' ? (
          <>ESTRATÉGIA {isRedTeam ? 'RED' : 'BLU'}: {currentStrategy === 'rush' ? 'RUSH AGRESSIVO' : currentStrategy === 'split' ? 'SPLIT TÁTICO' : currentStrategy === 'slow' ? 'EXECUÇÃO LENTA' : 'PADRÃO'} {tsTargetSite === 'site-a' ? 'SITE A' : 'SITE B'}</>
        ) : (
          <>ESTRATÉGIA {isRedTeam ? 'RED' : 'BLU'}: {bluStrategy === 'aggressive' ? 'DEFESA AVANÇADA' : bluStrategy === 'retake' ? 'SITUACIONAL (RETAKE)' : bluStrategy === 'stack-a' ? 'STACK SITE A (ECONÔMICO)' : bluStrategy === 'stack-b' ? 'STACK SITE B (ECONÔMICO)' : 'DEFESA ESTÁTICA'} SITE A e B</>
        )}
      </div>
      {robots.filter(r => r.team === team).map(r => (
        <div key={r.id} style={{ marginBottom: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, opacity: r.state.hp <= 0 ? 0.5 : 1, borderLeft: `4px solid ${r.state.hp <= 0 ? '#555' : teamColor}` }}>
          <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            <span>{r.name}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ color: '#aaa', fontSize: 10 }}>{r.kills}/{r.assists}/{r.deaths}</span>
              <span style={{ color: '#4caf50' }}>${r.money}</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>{r.role}</div>
          <div style={{ height: 4, width: '100%', backgroundColor: '#333', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${r.state.hp}%`, backgroundColor: r.state.hp > 30 ? '#4caf50' : '#f44336', transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
            <span>🔫 {r.state.inventory.primary?.name || r.state.inventory.secondary.name}</span>
            {r.state.inventory.hasArmor && <span>🛡️ Kev+H</span>}
            {r.state.inventory.hasDefuseKit && <span>🔧 Kit</span>}
            {r.hasBomb && <span>💣 C4</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

const ScoreboardOverlay = ({ title, showFooter = true, showRestart = false, robots, scores, restartGame }: { title?: string; showFooter?: boolean; showRestart?: boolean; robots: Robot[]; scores: { RED: number; BLU: number }; restartGame: () => void }) => {
  const computeDamageDealt = (id: string) => robots.reduce((sum, r) => sum + (r.damageDealtBy.get(id) || 0), 0);
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '80%', maxWidth: 1000, background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
        {title && <h2 style={{ color: '#fff', textAlign: 'center', marginBottom: 24, fontSize: 32, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2 }}>{title}</h2>}
        <div style={{ display: 'flex', gap: 30 }}>
          {(['RED', 'BLU'] as const).map(colorTeam => (
            <div key={colorTeam} style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: `3px solid ${colorTeam === 'RED' ? '#ff8c00' : '#1e90ff'}`, paddingBottom: 8 }}>
                <h3 style={{ color: colorTeam === 'RED' ? '#ff8c00' : '#1e90ff', margin: 0, fontSize: 20 }}>{colorTeam === 'RED' ? '🔴 RED TEAM' : '🔵 BLU TEAM'}</h3>
                <span style={{ fontSize: 28, fontWeight: 'bold', color: '#fff' }}>{colorTeam === 'RED' ? scores.RED : scores.BLU}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.6fr 0.6fr 0.8fr 0.8fr', padding: '8px 12px', color: '#666', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>
                <div>Jogador</div><div style={{ textAlign: 'center' }}>K</div><div style={{ textAlign: 'center' }}>A</div><div style={{ textAlign: 'center' }}>D</div><div style={{ textAlign: 'center' }}>Dano</div><div style={{ textAlign: 'right' }}>$</div>
              </div>
              {robots.filter(r => r.name.startsWith(colorTeam)).map(r => {
                const dmg = computeDamageDealt(r.id);
                return (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.6fr 0.6fr 0.8fr 0.8fr', padding: '10px 12px', alignItems: 'center', borderBottom: '1px solid #222', fontSize: 13, background: r.state.hp <= 0 ? 'rgba(255,0,0,0.05)' : 'rgba(255,255,255,0.02)', color: r.state.hp <= 0 ? '#555' : '#eee', borderRadius: 4, marginBottom: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: colorTeam === 'RED' ? '#ff8c00' : '#1e90ff', opacity: r.state.hp > 0 ? 1 : 0.3 }} />
                      <span style={{ fontWeight: r.state.hp > 0 ? 'bold' : 'normal' }}>{r.name}</span>
                      {r.hasBomb && <span title="Portador da C4">💣</span>}
                    </div>
                    <div style={{ textAlign: 'center' }}>{r.kills}</div>
                    <div style={{ textAlign: 'center' }}>{r.assists}</div>
                    <div style={{ textAlign: 'center' }}>{r.deaths}</div>
                    <div style={{ textAlign: 'center', color: r.state.hp > 0 ? '#4caf50' : '#2e7d32' }}>{Math.round(dmg)}</div>
                    <div style={{ textAlign: 'right', color: '#ffd700' }}>${r.money}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {showRestart && (
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <button onClick={restartGame} style={{ padding: '16px 48px', fontSize: 20, backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 4px 0 #222' }} onMouseDown={(e) => e.currentTarget.style.transform = 'translateY(2px)'} onMouseUp={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              🔄 REINICIAR PARTIDA
            </button>
          </div>
        )}
        {showFooter && !showRestart && (
          <div style={{ marginTop: 20, color: '#555', fontSize: 12, textAlign: 'center' }}>Segure [TAB] para ver o placar detalhado</div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [robots, setRobots] = useState<Robot[]>(createInitialRobots());
  const [isRunning, setIsRunning] = useState(false);
  const ROUND_DURATION_MS = 115000;
  const BOMB_TIMER_MS = 30000;
  const [roundTimeMs, setRoundTimeMs] = useState(ROUND_DURATION_MS);
  const lastInteractionTimeRef = useRef(0);
  const [uiNow, setUiNow] = useState(0);
  const [scores, setScores] = useState({ RED: 0, BLU: 0 });
  const [bomb, setBomb] = useState<BombState>({ isPlanted: false, isDropped: false });
  const [tsTargetSite, setTsTargetSite] = useState<'site-a' | 'site-b'>('site-a');
  const [currentStrategy, setCurrentStrategy] = useState<'rush' | 'split' | 'slow' | 'default'>('rush');
  const [bluStrategy, setBluStrategy] = useState<'default' | 'aggressive' | 'retake' | 'stack-a' | 'stack-b'>('default');
  const [logs, setLogs] = useState<string[]>([]);
  const [lossBonus, setLossBonus] = useState({ CT: 0, T: 0 });
  const [plantThisRound, setPlantThisRound] = useState(false);
  const [lastEnemyPos, setLastEnemyPos] = useState<LastEnemyPos>({});
  const [sounds, setSounds] = useState<SoundEvent[]>([]);
  const [isBetweenRounds, setIsBetweenRounds] = useState(false);
  const [roundWinner, setRoundWinner] = useState<{ team: TeamSide, cause: string } | null>(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [matchWinner, setMatchWinner] = useState<'RED' | 'BLU' | 'DRAW' | null>(null);
  const [isHalfTime, setIsHalfTime] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const MAX_ROUNDS = 12;
  const HALF_ROUNDS = 6;
  const [showOverlay, setShowOverlay] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);

  const isSwappedRef = useRef(isSwapped);
  const currentRoundRef = useRef(currentRound);
  const lossBonusRef = useRef(lossBonus);
  const matchWinnerRef = useRef(matchWinner);
  const endRoundLockRef = useRef(false);
  const isBetweenRoundsRef = useRef(isBetweenRounds);
  const plantThisRoundRef = useRef(plantThisRound);
  const currentStrategyRef = useRef(currentStrategy);
  const bluStrategyRef = useRef(bluStrategy);

  const formatTime = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const endRound = (winner: TeamSide, cause: string) => {
    if (endRoundLockRef.current || matchWinnerRef.current || isBetweenRoundsRef.current) return;
    endRoundLockRef.current = true;

    setIsRunning(false);
    isBetweenRoundsRef.current = true;
    setIsBetweenRounds(true);
    setRoundWinner({ team: winner, cause });

    const endedRound = currentRoundRef.current;

    setScores(prev => {
      const winnerColor = isSwappedRef.current ? (winner === 'CT' ? 'RED' : 'BLU') : (winner === 'CT' ? 'BLU' : 'RED');
      const nextScores = { ...prev, [winnerColor]: prev[winnerColor] + 1 };
      setLogs(logsPrev => [`${formatTime(roundTimeMsRef.current)} Round venceu ${winnerColor} (${cause})`, ...logsPrev].slice(0, 50));

      setTimeout(() => {
        const isMatchFinished = nextScores.BLU >= 7 || nextScores.RED >= 7 || (nextScores.BLU === 6 && nextScores.RED === 6);
        if (isMatchFinished) {
          const mw = nextScores.RED > nextScores.BLU ? 'RED' : (nextScores.BLU > nextScores.RED ? 'BLU' : 'DRAW');
          matchWinnerRef.current = mw;
          setMatchWinner(mw);
          isBetweenRoundsRef.current = false;
          setIsBetweenRounds(false);
          endRoundLockRef.current = false;
          return;
        }

        const nextRound = currentRoundRef.current + 1;
        currentRoundRef.current = nextRound;
        setCurrentRound(nextRound);

        const doSwap = nextRound === HALF_ROUNDS + 1 && !isSwappedRef.current;
        if (doSwap) {
          isSwappedRef.current = true;
          setIsSwapped(true);
        }

        const startNextRound = () => {
          setRobots(robotsPrev => {
            const rs = [...robotsPrev];

            const winAmount = (cause === 'explosão' || cause === 'desarme') ? 3500 : 3250;
            rs.forEach(r => { if (r.team === winner) r.money = clampMoney(r.money + winAmount); });
            const loser = winner === 'CT' ? 'T' : 'CT';
            const payLoss = lossBonusRef.current[loser] > 0 ? lossBonusRef.current[loser] : 1400;
            rs.forEach(r => { if (r.team === loser) r.money = clampMoney(r.money + payLoss); });
            setLossBonus(lbPrev => {
              const nextLb = { ...lbPrev, [loser]: Math.min(3400, (lbPrev[loser] > 0 ? lbPrev[loser] + 500 : 1900)), [winner]: 0 };
              lossBonusRef.current = nextLb;
              return nextLb;
            });
            if (plantThisRoundRef.current) rs.forEach(r => { if (r.team === 'T') r.money = clampMoney(r.money + 800); });

            if (doSwap) {
              rs.forEach(r => { r.money = 800; });
              lossBonusRef.current = { CT: 0, T: 0 };
              setLossBonus({ CT: 0, T: 0 });
            }

            if (doSwap) {
              rs.forEach(r => { r.team = r.team === 'CT' ? 'T' : 'CT'; });
            }

            rs.forEach(r => {
              const wasAlive = r.state.hp > 0;
              r.state.hp = 100;
              r.damageDealtBy.clear();
              const idx = Number(r.id.split('-')[1]);
              const spawn = r.team === 'CT' ? DUST2_MAP.spawnPoints.CT[idx] : DUST2_MAP.spawnPoints.T[idx];
              r.state.position = { ...spawn };
              r.state.angle = 0;
              r.state.currentAction = 'Idle';
              r.targetPoint = null;
              r.hasBomb = false;
              r.plantingUntil = undefined;
              r.defusingUntil = undefined;

              if (!wasAlive || doSwap) {
                r.state.inventory.primary = undefined;
                r.state.inventory.hasArmor = false;
                r.state.inventory.hasHelmet = false;
                r.state.inventory.hasDefuseKit = false;
                r.state.inventory.secondary = r.team === 'CT' ? USP : GLOCK;
              }
            });

            const tBots = rs.filter(r => r.team === 'T');
            if (tBots.length > 0) tBots[Math.floor(Math.random() * tBots.length)].hasBomb = true;

            rs.forEach(r => {
              if (!r.state.inventory.hasArmor && r.money >= 1000) {
                r.money -= 1000;
                r.state.inventory.hasArmor = true;
                r.state.inventory.hasHelmet = true;
              }

              if (!r.state.inventory.primary) {
                if (r.role === 'Sniper') {
                  if (r.money >= SHOP.sniper.price) {
                    r.state.inventory.primary = { ...SHOP.sniper };
                    r.money -= SHOP.sniper.price;
                  }
                } else if (r.money >= SHOP.rifle.price) {
                  r.state.inventory.primary = { ...SHOP.rifle };
                  r.money -= SHOP.rifle.price;
                }
              }

              if (r.team === 'CT' && !r.state.inventory.hasDefuseKit && r.money >= 400) {
                r.state.inventory.hasDefuseKit = true;
                r.money -= 400;
              }
            });

            roundTimeMsRef.current = ROUND_DURATION_MS;
            setRoundTimeMs(ROUND_DURATION_MS);
            const resetBomb: BombState = { isPlanted: false, isDropped: false };
            bombRef.current = resetBomb;
            setBomb(resetBomb);
            const nextSite = Math.random() < 0.5 ? 'site-a' : 'site-b';
            tsTargetSiteRef.current = nextSite;
            setTsTargetSite(nextSite);

            const redStrats: ('rush' | 'split' | 'slow' | 'default')[] = ['rush', 'split', 'slow', 'default'];
            const bluStrats: ('default' | 'aggressive' | 'retake' | 'stack-a' | 'stack-b')[] = ['default', 'aggressive', 'retake'];

            const ctRobots = rs.filter(r => r.team === 'CT');
            const avgMoney = ctRobots.reduce((sum, r) => sum + r.money, 0) / ctRobots.length;
            if (avgMoney < 2500) bluStrats.push('stack-a', 'stack-b');

            const nextRed = redStrats[Math.floor(Math.random() * redStrats.length)];
            const nextBlu = bluStrats[Math.floor(Math.random() * bluStrats.length)];
            currentStrategyRef.current = nextRed;
            bluStrategyRef.current = nextBlu;
            setCurrentStrategy(nextRed);
            setBluStrategy(nextBlu);

            plantThisRoundRef.current = false;
            setPlantThisRound(false);
            lastEnemyPosRef.current = {};
            setLastEnemyPos({});
            lastInteractionTimeRef.current = Date.now();
            return rs;
          });

          setRoundWinner(null);
          isBetweenRoundsRef.current = false;
          setIsBetweenRounds(false);
          setIsHalfTime(false);
          endRoundLockRef.current = false;
          setIsRunning(true);
        };

        if (endedRound === HALF_ROUNDS) {
          setIsHalfTime(true);
          setTimeout(startNextRound, 10000);
        } else {
          startNextRound();
        }
      }, 3000);

      return nextScores;
    });
  };

  const restartGame = () => {
    endRoundLockRef.current = false;
    isBetweenRoundsRef.current = false;
    plantThisRoundRef.current = false;
    currentRoundRef.current = 1;
    isSwappedRef.current = false;
    matchWinnerRef.current = null;
    lossBonusRef.current = { CT: 0, T: 0 };

    setIsRunning(false);
    setIsBetweenRounds(false);
    setIsHalfTime(false);
    setRoundWinner(null);
    setMatchWinner(null);
    setLossBonus({ CT: 0, T: 0 });
    setScores({ RED: 0, BLU: 0 });
    setLogs([]);
    setCurrentRound(1);
    setIsSwapped(false);

    const next = createInitialRobots();
    setRobots(next);
    roundTimeMsRef.current = ROUND_DURATION_MS;
    setRoundTimeMs(ROUND_DURATION_MS);
    const resetBomb: BombState = { isPlanted: false, isDropped: false };
    bombRef.current = resetBomb;
    setBomb(resetBomb);
    const nextSite = Math.random() < 0.5 ? 'site-a' : 'site-b';
    tsTargetSiteRef.current = nextSite;
    setTsTargetSite(nextSite);
    soundsRef.current = [];
    setSounds([]);
    lastEnemyPosRef.current = {};
    setLastEnemyPos({});
    
    const redStrats: ('rush' | 'split' | 'slow' | 'default')[] = ['rush', 'split', 'slow', 'default'];
    const bluStrats: ('default' | 'aggressive' | 'retake' | 'stack-a' | 'stack-b')[] = ['default', 'aggressive', 'retake'];
    
    // Na reinicialização, detecta se é eco
    const ctRobots = next.filter(r => r.team === 'CT');
    const avgMoney = ctRobots.reduce((sum, r) => sum + r.money, 0) / ctRobots.length;
    if (avgMoney < 2500) bluStrats.push('stack-a', 'stack-b');

    const nextRed = redStrats[Math.floor(Math.random() * redStrats.length)];
    const nextBlu = bluStrats[Math.floor(Math.random() * bluStrats.length)];
    currentStrategyRef.current = nextRed;
    bluStrategyRef.current = nextBlu;
    setCurrentStrategy(nextRed);
    setBluStrategy(nextBlu);
    
    setPlantThisRound(false);
  };

  const bombRef = useRef(bomb);
  const tsTargetSiteRef = useRef(tsTargetSite);
  const soundsRef = useRef(sounds);
  const roundTimeMsRef = useRef(roundTimeMs);
  const lastEnemyPosRef = useRef(lastEnemyPos);

  useEffect(() => { if (isRunning) lastInteractionTimeRef.current = Date.now(); }, [isRunning]);

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        const now = Date.now();
        
        // --- SIMULAÇÃO ---
        // Usamos variáveis locais para acumular mudanças e evitar múltiplas chamadas de state
        const nextRoundTime = Math.max(0, roundTimeMsRef.current - 16);
        const nextSounds = soundsRef.current.filter(s => now - s.time < 500);
        let nextBomb = { ...bombRef.current };
        const nextLastEnemyPos = { ...lastEnemyPosRef.current };
        let nextPlantThisRound = plantThisRoundRef.current;

        setRobots(prev => {
          const newRobots = [...prev];
          const aliveT = newRobots.filter(r => r.team === 'T' && r.state.hp > 0).length;
          const aliveCT = newRobots.filter(r => r.team === 'CT' && r.state.hp > 0).length;
          
          if (!nextBomb.isPlanted) {
            if (aliveT === 0) { setTimeout(() => endRound('CT', 'eliminação'), 0); return newRobots; }
            if (aliveCT === 0) { setTimeout(() => endRound('T', 'eliminação'), 0); return newRobots; }
            if (nextRoundTime <= 0) { setTimeout(() => endRound('CT', 'tempo'), 0); return newRobots; }
          } else if (aliveCT === 0) {
            setTimeout(() => endRound('T', 'eliminação'), 0); return newRobots;
          }

          // Se a C4 está plantada, prioriza a resolução pela explosão/desarme
          if (nextBomb.isPlanted && nextBomb.plantedAt && now - nextBomb.plantedAt >= BOMB_TIMER_MS) { 
            setTimeout(() => endRound('T', 'explosão'), 0); return newRobots; 
          }
          
          // Save mútuo só é possível se a bomba NÃO estiver plantada
          if (!nextBomb.isPlanted && isRunning && !isBetweenRoundsRef.current && (now - lastInteractionTimeRef.current > 45000)) {
            setTimeout(() => endRound('CT', 'save mútuo'), 0); return newRobots;
          }

          const siteA = getZoneById('site-a'); 
          const siteB = getZoneById('site-b');
          const targetSite = tsTargetSiteRef.current === 'site-a' ? siteA : siteB;
          const targetSiteCenter = getZoneCenter(targetSite);

          newRobots.forEach(robot => {
            if (robot.state.hp <= 0) return;

            if (robot.state.currentAction === 'Moving' && !robot.isWalking && Math.random() < 0.05) {
              const sound = { x: robot.state.position.x, y: robot.state.position.y, type: 'step' as const, team: robot.team, time: now };
              nextSounds.push(sound);
              // Outros robôs ouvem o som
              newRobots.forEach(other => {
                if (other.id !== robot.id && other.team !== robot.team) {
                  other.hearSound(sound, 'step');
                }
              });
            }

            const enemies = newRobots.filter(r => r.team !== robot.team && r.state.hp > 0);
            const visibleEnemy = enemies.find(e => robot.canSee(e));

            if (visibleEnemy) {
              if (robot.state.currentAction === 'Planting' || robot.state.currentAction === 'Defusing') {
                if (robot.state.hp < 40) { robot.plantingUntil = undefined; robot.defusingUntil = undefined; } 
                else { return; }
              }
              
              robot.state.currentAction = 'Combat'; 
              robot.defusingUntil = undefined; 
              robot.plantingUntil = undefined;
              
              const angleToEnemy = Math.atan2(visibleEnemy.state.position.y - robot.state.position.y, visibleEnemy.state.position.x - robot.state.position.x);
              robot.rotateTowards(angleToEnemy, 0.4);

              const hp = robot.state.hp;
              const matesNearby = newRobots.filter(r => r.team === robot.team && r.id !== robot.id && r.state.hp > 0 && Math.hypot(r.state.position.x - robot.state.position.x, r.state.position.y - robot.state.position.y) < 200);
              
              const speed = (10 + robot.attributes.agility * 0.5) * (16 / 1000);
              if (hp < 40 && matesNearby.length === 0) {
                const retreatAngle = angleToEnemy + Math.PI;
                robot.moveTowardsLimited(robot.state.position.x + Math.cos(retreatAngle) * 50, robot.state.position.y + Math.sin(retreatAngle) * 50, speed, newRobots, false);
              } else {
                const strafeDir = (Math.floor(now / 1000) % 2 === 0 ? 1 : -1);
                const strafeAngle = angleToEnemy + (Math.PI / 2) * strafeDir;
                robot.moveTowardsLimited(robot.state.position.x + Math.cos(strafeAngle) * 30, robot.state.position.y + Math.sin(strafeAngle) * 30, speed * 0.8, newRobots, false);
              }

              nextLastEnemyPos[robot.team] = { ...visibleEnemy.state.position };

              const curWep = robot.state.inventory.primary || robot.state.inventory.secondary;
              if (now - robot.lastFiredTime >= (1000 / curWep.fireRate)) {
                robot.lastFiredTime = now; 
                lastInteractionTimeRef.current = now;
                const sound = { x: robot.state.position.x, y: robot.state.position.y, type: 'gunshot' as const, team: robot.team, time: now };
                nextSounds.push(sound);
                
                // Inimigos ouvem o tiro
                newRobots.forEach(other => {
                  if (other.id !== robot.id && other.team !== robot.team) {
                    other.hearSound(sound, 'gunshot');
                  }
                });
                
                if (Math.random() < (robot.getFinalPrecision() * 0.7)) {
                  const dist = Math.hypot(visibleEnemy.state.position.x - robot.state.position.x, visibleEnemy.state.position.y - robot.state.position.y);
                  const baseDamage = curWep.damage;
                  const falloffStart = curWep.range * 0.35;
                  const minFactor = curWep.id === 'AWP' ? 0.9 : (curWep.category === 'Secondary' ? 0.55 : 0.7);
                  let factor = 1;
                  if (dist > falloffStart) {
                    const t = Math.min(1, Math.max(0, (dist - falloffStart) / Math.max(1, (curWep.range - falloffStart))));
                    factor = 1 - (1 - minFactor) * t;
                  }
                  const finalDamage = Math.max(1, baseDamage * factor * (0.9 + Math.random() * 0.2));
                  visibleEnemy.takeDamage(finalDamage, robot.id, robot.state.position, (dead) => {
                    if (dead.hasBomb) { 
                      dead.hasBomb = false; 
                      nextBomb = { ...nextBomb, isDropped: true, position: { ...dead.state.position } };
                      const time = formatTime(nextRoundTime);
                      setLogs(prev => [`${time} A C4 foi dropada!`, ...prev].slice(0, 50));
                    }
                  });
                  if (visibleEnemy.state.hp <= 0) { 
                    robot.kills++; 
                    // Bônus por eliminação: $300 (exclusivo para o jogador)
                    robot.money = clampMoney(robot.money + 300);
                    setLogs(prev => [`${formatTime(nextRoundTime)} ${robot.name} eliminou ${visibleEnemy.name} (+$300)`, ...prev].slice(0, 50));
                  }
                }
              }
            } else {
              robot.state.currentAction = 'Idle';
              
              // Removendo lógica de rotação simplificada do loop principal,
              // agora ela será tratada dentro de updateDecision com mais prioridade.
              
              robot.updateDecision(now, robot.team === 'T' ? aliveT : aliveCT, robot.team === 'T' ? aliveCT : aliveT, nextRoundTime, nextBomb, targetSiteCenter, currentStrategyRef.current, bluStrategyRef.current, siteA, siteB, newRobots, nextLastEnemyPos);
              
              if (robot.team === 'T') {
                if (!nextBomb.isPlanted && !nextBomb.isDropped && robot.hasBomb && isInsideZone(robot.state.position, targetSite)) {
                  if (!robot.plantingUntil) { robot.plantingUntil = now + 5000; }
                  else if (now >= robot.plantingUntil) { 
                    lastInteractionTimeRef.current = now; 
                    nextBomb = { isPlanted: true, isDropped: false, siteId: tsTargetSiteRef.current, plantedAt: now, position: { ...robot.state.position } };
                    nextPlantThisRound = true;
                    robot.hasBomb = false; 
                    robot.plantingUntil = undefined; 
                    
                    // Bônus para todos os TRs por plantar a C4: $300
                    newRobots.forEach(r => { if (r.team === 'T') r.money = clampMoney(r.money + 300); });
                    setLogs(prev => [`${formatTime(nextRoundTime)} C4 Plantada! Bônus de $300 para o time T`, ...prev].slice(0, 50));
                  }
                  robot.state.currentAction = 'Planting';
                }
                if (nextBomb.isDropped && nextBomb.position && !robot.hasBomb && Math.hypot(robot.state.position.x - nextBomb.position.x, robot.state.position.y - nextBomb.position.y) < 35) { 
                  robot.hasBomb = true; 
                  nextBomb = { ...nextBomb, isDropped: false, position: undefined };
                  const time = formatTime(nextRoundTime);
                  setLogs(prev => [`${time} ${robot.name} recuperou a C4`, ...prev].slice(0, 50));
                }
              } else if (nextBomb.isPlanted) {
                const pSite = nextBomb.siteId === 'site-a' ? siteA : siteB;
                if (isInsideZone(robot.state.position, pSite)) {
                  if (!robot.defusingUntil) { robot.defusingUntil = now + (robot.state.inventory.hasDefuseKit ? 5000 : 10000); }
                  else if (now >= robot.defusingUntil) { 
                    // Bônus para todos os CTs por desarmar a C4: $300
                    newRobots.forEach(r => { if (r.team === 'CT') r.money = clampMoney(r.money + 300); });
                    setLogs(prev => [`${formatTime(nextRoundTime)} C4 Desarmada! Bônus de $300 para o time CT`, ...prev].slice(0, 50));
                    setTimeout(() => endRound('CT', 'desarme'), 0); 
                    return newRobots; 
                  }
                  robot.state.currentAction = 'Defusing';
                }
              }

              if (robot.targetPoint) {
                const speed = (robot.isWalking ? (10 + robot.attributes.agility * 0.5) * 0.5 : (10 + robot.attributes.agility * 0.5)) * (16 / 1000);
                robot.moveTowardsLimited(robot.targetPoint.x, robot.targetPoint.y, speed, newRobots, true);
              } else if (robot.lookAtPoint) {
                // Se não está se movendo mas tem onde olhar, rotaciona parado
                const lookAngle = Math.atan2(robot.lookAtPoint.y - robot.state.position.y, robot.lookAtPoint.x - robot.state.position.x);
                robot.rotateTowards(lookAngle, 0.15);
              }
            }
          });

          // --- APLICAR MUDANÇAS ---
          // Atualizamos os estados secundários FORA do loop de robots se necessário, 
          // mas como estamos dentro de setRobots, faremos isso via Refs para o próximo frame
          // e via setters comuns DEPOIS do setRobots terminar (usando setTimeout).
          setTimeout(() => {
            roundTimeMsRef.current = nextRoundTime;
            soundsRef.current = nextSounds;
            bombRef.current = nextBomb;
            lastEnemyPosRef.current = nextLastEnemyPos;
            plantThisRoundRef.current = nextPlantThisRound;
            setRoundTimeMs(nextRoundTime);
            setSounds(nextSounds);
            setBomb(nextBomb);
            setLastEnemyPos(nextLastEnemyPos);
            setPlantThisRound(nextPlantThisRound);
            setUiNow(now);
          }, 0);

          return [...newRobots];
        });
      }, 16);
      return () => clearInterval(interval);
    }
  }, [isRunning]); // Dependência apenas em isRunning

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowScoreboard(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setShowScoreboard(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return (
    <div style={{ backgroundColor: '#111', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, width: '100%', boxSizing: 'border-box', fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 1160, border: '1px solid #333', padding: '12px 24px', borderRadius: 12, marginBottom: 16, background: 'linear-gradient(180deg, #1a1a1a 0%, #121212 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
        <div style={{ color: isSwapped ? '#ff8c00' : '#1e90ff', fontWeight: 'bold', fontSize: 24 }}>{isSwapped ? `RED ${scores.RED}` : `BLU ${scores.BLU}`}</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: 1 }}>VibeCoding - CS Minimap</div>
          <div style={{ color: '#aaa', fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>ROUND {currentRound}/{MAX_ROUNDS}</div>
          {!bomb.isPlanted ? (
            <div style={{ color: '#ddd', fontSize: 18, fontFamily: 'monospace' }}>{formatTime(roundTimeMs)}</div>
          ) : (
            <div style={{ color: '#ffcc00', fontSize: 18, fontFamily: 'monospace', animation: 'pulse 1s infinite' }}>BOMBA: 00:{String(Math.max(0, Math.ceil((BOMB_TIMER_MS - (uiNow - (bomb.plantedAt || 0))) / 1000))).padStart(2, '0')}</div>
          )}
        </div>
        <div style={{ color: isSwapped ? '#1e90ff' : '#ff8c00', fontWeight: 'bold', fontSize: 24 }}>{isSwapped ? `BLU ${scores.BLU}` : `RED ${scores.RED}`}</div>
      </div>

      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', width: '100%', maxWidth: 1400 }}>
        <RobotPanel team="CT" robots={robots} isSwapped={isSwapped} currentStrategy={currentStrategy} bluStrategy={bluStrategy} tsTargetSite={tsTargetSite} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #333', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
            <GameCanvas robots={robots} bomb={bomb} sounds={sounds} showOverlay={showOverlay} />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => setIsRunning(!isRunning)} style={{ padding: '10px 24px', backgroundColor: isRunning ? '#f44336' : '#4caf50', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', minWidth: 120 }}>{isRunning ? '⏸ PAUSE' : '▶ START'}</button>
            <button onClick={restartGame} style={{ padding: '10px 24px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>🔄 RESET MATCH</button>
            <button onClick={() => setShowOverlay(!showOverlay)} style={{ padding: '10px 24px', backgroundColor: showOverlay ? '#1e90ff' : '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>📍 WAYPOINTS</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div style={{ color: '#444', fontSize: 11, textAlign: 'center' }}>Segure [TAB] para ver o placar detalhado</div>
            <div style={{ width: 520, maxWidth: '100%', backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid #222', borderRadius: 8, padding: '8px 10px', fontFamily: 'monospace', fontSize: 12, color: '#bbb', height: 110, overflow: 'hidden' }}>
              {logs.length === 0 ? (
                <div style={{ color: '#555' }}>Eventos do round aparecem aqui</div>
              ) : (
                logs.slice(0, 6).map((l, i) => (
                  <div key={i} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</div>
                ))
              )}
            </div>
          </div>
        </div>
        <RobotPanel team="T" robots={robots} isSwapped={isSwapped} currentStrategy={currentStrategy} bluStrategy={bluStrategy} tsTargetSite={tsTargetSite} />
      </div>

      {/* Overlays */}
      {showScoreboard && <ScoreboardOverlay title="Placar da Partida" robots={robots} scores={scores} restartGame={restartGame} />}
      {isHalfTime && <ScoreboardOverlay title="⏸️ Intervalo (10s)" showFooter={false} robots={robots} scores={scores} restartGame={restartGame} />}
      {matchWinner && (
        <ScoreboardOverlay 
          title={matchWinner === 'DRAW' ? '🤝 Empate!' : `🏆 Vitória do Time ${matchWinner}!`} 
          showFooter={false} 
          showRestart={true} 
          robots={robots}
          scores={scores}
          restartGame={restartGame}
        />
      )}

      {!isRunning && !isBetweenRounds && !matchWinner && !isHalfTime && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid #333', padding: '40px 60px', borderRadius: 24, textAlign: 'center', width: '90%', maxWidth: 900, boxShadow: '0 30px 100px rgba(0,0,0,0.9)' }}>
            <div style={{ marginBottom: 30 }}>
              <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8, letterSpacing: 3, color: '#fff' }}>VIBECODING ENGINE</h1>
              <div style={{ color: '#ffcc00', fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>MAPA: DUST</div>
            </div>

            <div style={{ display: 'flex', gap: 30, marginBottom: 35 }}>
              {/* BLU Side */}
              <div style={{ flex: 1, backgroundColor: 'rgba(30,144,255,0.05)', padding: 15, borderRadius: 12, border: '1px solid rgba(30,144,255,0.2)', textAlign: 'left' }}>
                <h3 style={{ color: '#1e90ff', borderBottom: '2px solid #1e90ff', paddingBottom: 6, marginBottom: 12, textAlign: 'center', fontSize: 16 }}>🔵 BLU TEAM</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {robots.filter(r => r.team === 'CT').map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ fontWeight: 'bold' }}>{r.name}</span>
                      <span style={{ color: '#666' }}>{r.role}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map Preview */}
              <div style={{ flex: 1.2, position: 'relative', borderRadius: 12, overflow: 'hidden', border: '2px solid #333', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                <div style={{ 
                  width: '100%', 
                  height: 200, 
                  background: '#1a1a1a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  padding: 10
                }}>
                  {/* Paredes Simplificadas */}
                  <div style={{ position: 'absolute', width: '80%', height: '60%', border: '2px solid #333', background: '#111' }}></div>
                  
                  {/* Meio */}
                  <div style={{ position: 'absolute', width: '15%', height: '100%', background: 'rgba(255,255,255,0.03)', borderLeft: '1px solid #222', borderRight: '1px solid #222' }}></div>
                  
                  {/* Site B */}
                  <div style={{ position: 'absolute', top: '15%', left: '15%', width: 40, height: 40, border: '2px dashed #ffcc00', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffcc00', fontSize: 14, fontWeight: 'bold', background: 'rgba(255,204,0,0.05)' }}>B</div>
                  
                  {/* Site A */}
                  <div style={{ position: 'absolute', top: '15%', right: '15%', width: 40, height: 40, border: '2px dashed #ffcc00', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffcc00', fontSize: 14, fontWeight: 'bold', background: 'rgba(255,204,0,0.05)' }}>A</div>
                  
                  {/* Spawn RED */}
                  <div style={{ position: 'absolute', bottom: '10%', left: '40%', width: 60, height: 25, background: 'rgba(255,140,0,0.1)', border: '1px solid #ff8c00', borderRadius: 4, color: '#ff8c00', fontSize: 9, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>RED SPAWN</div>
                  
                  {/* Spawn BLU */}
                  <div style={{ position: 'absolute', top: '10%', left: '40%', width: 60, height: 25, background: 'rgba(30,144,255,0.1)', border: '1px solid #1e90ff', borderRadius: 4, color: '#1e90ff', fontSize: 9, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>BLU SPAWN</div>
                  
                  {/* Rotas */}
                  <div style={{ position: 'absolute', bottom: '25%', left: '20%', width: 2, height: '50%', background: 'rgba(255,255,255,0.05)' }} title="Tunnels"></div>
                  <div style={{ position: 'absolute', bottom: '25%', right: '20%', width: 2, height: '50%', background: 'rgba(255,255,255,0.05)' }} title="Long"></div>
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', padding: '6px 0', color: '#fff', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>MAPA: DUST</div>
              </div>

              {/* RED Side */}
              <div style={{ flex: 1, backgroundColor: 'rgba(255,140,0,0.05)', padding: 15, borderRadius: 12, border: '1px solid rgba(255,140,0,0.2)', textAlign: 'left' }}>
                <h3 style={{ color: '#ff8c00', borderBottom: '2px solid #ff8c00', paddingBottom: 6, marginBottom: 12, textAlign: 'center', fontSize: 16 }}>🔴 RED TEAM</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {robots.filter(r => r.team === 'T').map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ fontWeight: 'bold' }}>{r.name}</span>
                      <span style={{ color: '#666' }}>{r.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => { setTsTargetSite(Math.random() < 0.5 ? 'site-a' : 'site-b'); setIsRunning(true); lastInteractionTimeRef.current = Date.now(); setUiNow(Date.now()); }}
              style={{ 
                padding: '16px 40px', 
                backgroundColor: '#4caf50', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 8, 
                cursor: 'pointer', 
                fontSize: 18, 
                fontWeight: 'bold', 
                minWidth: 300, 
                boxShadow: '0 5px 0 #2e7d32', 
                transition: 'all 0.1s',
                textTransform: 'uppercase',
                letterSpacing: 1.5
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'translateY(2px)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              INICIAR PARTIDA
            </button>
            <div style={{ marginTop: 15, color: '#444', fontSize: 11 }}>Clique para iniciar a série de 12 rounds</div>
          </div>
        </div>
      )}

      {roundWinner && !isHalfTime && !matchWinner && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0,0,0,0.95)', padding: '40px 80px', borderRadius: 16, textAlign: 'center', border: `2px solid ${(isSwapped ? roundWinner.team === 'CT' : roundWinner.team === 'T') ? '#ff8c00' : '#1e90ff'}`, zIndex: 100, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
          <h2 style={{ fontSize: 42, color: (isSwapped ? roundWinner.team === 'CT' : roundWinner.team === 'T') ? '#ff8c00' : '#1e90ff', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 2 }}>
            Vitória {(isSwapped ? roundWinner.team === 'CT' : roundWinner.team === 'T') ? 'RED' : 'BLU'}
          </h2>
          <p style={{ fontSize: 24, color: '#aaa', margin: 0 }}>Causa: {roundWinner.cause}</p>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}</style>
    </div>
  );
}
