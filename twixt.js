function between(val, end1, end2) {
    return ( ((end1<val) && (val<end2)) || ((end1>val) && (val>end2)) )
}

/** Player enum */
const Player = {
    R: "R", // red
    B: "B", // black
    X: "X", // none
}

/** Colors enum */
const COLORS = {
    red: "#ff0000",
    black: "#000000",
    gray: "#cccccc",
}


/** Represents a peg location corresponding to an (x,y) coordinate on the board */
class Peg {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    /** Convert to 2-long array representation */
    get asTuple() {
        return [this.x, this.y];
    }

    /** 
     * Equality operator given another Peg
     */
    equals(peg) {
        return (this.x===peg.x) && (this.y===peg.y);
    }

    /**
     * Greater than operator given another Peg
     * Useful for creating a lexical ordering
     * Ordering is done first by x coordinate, then y coordinate
     */
    gt(peg) {
        if (this.x === peg.x) {
            return this.y > peg.y;
        } else {
            return this.x > peg.x;
        } 
    }

    /**
     * Less than operator given another Peg
     * Useful for creating a lexical ordering
     * Ordering is done first by x coordinate, then y coordinate
     */
    lt(peg) {
        if (this.x === peg.x) {
            return this.y < peg.y;
        } else {
            return this.x < peg.x;
        }
    }
}


/** A TwixT board with logic for placing and removing pegs and barriers */
class Board {
    constructor() {
        // initialize an empty board with no places pegs or barriers
        this.pegState = new Map()
        for (let i=1; i<=24; i++) {
            for (let j=1; j<=24; j++) {
                this._setPeg([i,j], Player.X);
            }
        }
        this.redBarrierState = new Array();
        this.blackBarrierState = new Array();
    }

    /**
     * Convert a peg in tuple format to a consistent string format
     * @param {Array} tuple
     * @returns {String} string of the format "1_2"
     */
    _stringifyPegTuple(tuple) {
        return `${tuple[0]}_${tuple[1]}`;
    }

    /**
     * Convert a peg in stringified format to tuple format
     * @param {String} str 
     * @returns {Array}
     */
    _destringifyPegTuple(str) {
        const split = str.split("_");
        return [parseInt(split[0]), parseInt(split[1])];
    }

    /** Set the color of the peg at the given board location */
    _setPeg(tuple, val) {
        this.pegState.set(this._stringifyPegTuple(tuple), val);
    }
    
    /** Get the color of the peg at the given board location */
    getPeg(tuple) {
        return this.pegState.get(this._stringifyPegTuple(tuple));
    }

    /**
     * Place a peg on the board after ensuring that the move is legal
     * @param {Peg} peg 
     * @param {String} color Player enum value
     * @returns {Boolean} success of operation
     */
    placePeg(peg, color) {
        // players cannot place pegs in the opponent's home rows
        if (color === Player.R) {
            if ((peg.x === 1) || (peg.x === 24)) {
                return false;
            }
        }
        if (color === Player.B) {
            if ((peg.y === 1) || (peg.y === 24)) {
                return false;
            }
        }

        // the space must be empty
        if (this.getPeg(peg.asTuple) !== Player.X) {
            return false;
        }

        // otherwise place the peg
        this._setPeg(peg.asTuple, color);
        return true;
    }

    /**
     * Place a barrier on the board after ensuring that the move is legal
     * @param {Peg} peg1 
     * @param {Peg} peg2 
     * @param {String} color Player enum value
     * @returns {Boolean} success of operation
     */
    placeBarrier(peg1, peg2, color) {
        // a valid barrier has the pegs distance sqrt(5) apart
        if ((peg2.y-peg1.y)**2 + (peg2.x-peg1.x)**2 !== 5) {
            return false;
        }

        // the player must control both endpoint pegs
        if ((this.getPeg(peg1.asTuple) !== color) || (this.getPeg(peg2.asTuple) !== color)) {
            return false;
        }

        /*
        The proposed barrier must not intersect an existing barrier.
        To verify this, we compute the point of intersection between the line
        containing proposed barrier and each line containing an existing barrier,
        and then we check whether the point of intersection is inside the barrier.
        */
        for (const [peg3, peg4] of this.redBarrierState.concat(this.blackBarrierState)) {
            // note that if the pegs are the correct distance apart, slope cannot be undefined
            const m1 = (peg2.y-peg1.y) / (peg2.x-peg1.x); // slope of the new barrier
            const m3 = (peg4.y-peg3.y) / (peg4.x-peg3.x); // slope of the existing barrier
            
            if (m1 === m3) {
                // if the lines are parallel, then the move is legal unless it's the same barrier
                if (peg1.equals(peg3) && peg2.equals(peg4)) {
                    return false;
                }
                if (peg1.equals(peg4) && peg2.equals(peg3)) {
                    return false;
                }
            } else {
                // find the intersection point of the two lines
                let x = (peg1.x*m1 - peg3.x*m3 + peg3.y - peg1.y) / (m1 - m3);
                let y = m1*(x-peg1.x) + peg1.y;
                // check whether the intersection point is within the segment
                if (between(x, peg1.x, peg2.x) && between(x, peg3.x, peg4.x) && between(y, peg1.y, peg2.y) && between(y, peg3.y, peg4.y)) {
                    return false;
                }
            }
        }

        // otherwise place the barrier
        const barrier = peg1.lt(peg2) ? [peg1,peg2] : [peg2, peg1]; // ensure consistent ordering
        if (color === Player.R) {
            this.redBarrierState.push(barrier);
            return true;
        } else if (color === Player.B) {
            this.blackBarrierState.push(barrier);
            return true;
        } else{
            return false;
        }
    }

    /**
     * Remove the specified peg of the specified player
     * @param {Peg} peg 
     * @param {String} color Player enum value
     * @returns {Boolean} success of the operation
     */
    removePeg(peg, color) {
        // the player must have a peg in the location
        if (this.getPeg(peg.asTuple) === color) {

            // first remove any connected barriers
            if (color === Player.R) {
                this.redBarrierState = this.redBarrierState.filter(
                    (val) => !(peg.equals(val[0])) && !(peg.equals(val[1])));
            } else {
                this.blackBarrierState = this.blackBarrierState.filter(
                    (val) => !(peg.equals(val[0])) && !(peg.equals(val[1])));
            }

            // now remove the peg
            this._setPeg(peg.asTuple, Player.X);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Remove the barrier of the specified player given the endpoint pegs
     * @param {Peg} peg1 
     * @param {Peg} peg2 
     * @param {String} color Player enum value
     * @returns {Boolean} success of the operation
     */
    removeBarrier(peg1, peg2, color) {
        const barrier = peg1.lt(peg2) ? [peg1,peg2] : [peg2, peg1]; // ensure consistent ordering
        const barrierState = (color === Player.R) ? this.redBarrierState : this.blackBarrierState;

        // the player must have a barrier in that location
        for (let i=0; i<barrierState.length; i++) {
            let testBarrier = barrierState[i];
            if (barrier[0].equals(testBarrier[0]) && barrier[1].equals(testBarrier[1])) {
                barrierState.splice(i,1);
                return true
            }
        }
        return false;
    }

    /**
     * Find all the pegs adjacent by way of a barrier to the given peg
     * @param {Peg} peg
     * @returns {Array} a list of connected pegs
     */
    getAdjacentPegs(peg) {
        let barrierState;
        if (this.getPeg(peg.asTuple) === Player.B) {
            barrierState = this.blackBarrierState;
        } else if (this.getPeg(peg.asTuple) === Player.R) {
            barrierState = this.redBarrierState;
        } else {
            return [];
        }
        let lst = [];
        for (let [peg1, peg2] of barrierState) {
            if (peg.equals(peg1)) {
                lst.push(peg2);
            }
            if (peg.equals(peg2)) {
                lst.push(peg1);
            }
        }
        return lst;
    }

    /**
     * Determine whether the current state is a winning position for the given player
     * @param {String} player Player enum value
     * @returns {Boolean}
     */
    gameWon(player) {
        // find the pegs located in the player's first home row
        const queue = [];
        if (player === Player.R) {
            for (let i=1; i<=24; i++) {
                if (this.getPeg([i,1]) === Player.R) {
                    queue.push(this._stringifyPegTuple([i,1]));
                }
            }
        } else if (player === Player.B) {
            for (let i=1; i<=24; i++) {
                if (this.getPeg([1,i]) === Player.B) {
                    queue.push(this._stringifyPegTuple([1,i]));
                }
            }
        }

        // find all pegs connected to those in the player's first home row
        const connectedPegs = [];
        while (queue.length) {
            let pegStr = queue.pop();
                if (!connectedPegs.includes(pegStr)) {
                    connectedPegs.push(pegStr);
                    let peg = this._destringifyPegTuple(pegStr);
                    peg = new Peg(...peg)
                    let adjacentPegs = this.getAdjacentPegs(peg);
                    for (let adjacentPeg of adjacentPegs) {
                        queue.push(this._stringifyPegTuple(adjacentPeg.asTuple));
                    }
                }
        }

        // determine whether any of the connected pegs are in the player's other home row
        for (let pegStr of connectedPegs) {
            if (player === Player.R) {
                if (this._destringifyPegTuple(pegStr)[1] === 24) {
                    return true;
                }
            } else if (player === Player.B) {
                if (this._destringifyPegTuple(pegStr)[0] === 24) {
                    return true;
                }
            }
        }

        // otherwise the player has not won
        return false
    }
}


class BoardDisplay {
    TWIXT_GRID_WIDTH = 24; // pixels

    /**
     * View of the board
     * @constructor
     * @param {Board} board
     * @param {Game} game
     */
    constructor(board, game) {
        this.board = board;
        this.game = game;
        this.canvas = document.getElementById("twixt-canvas");
    }

    /**
     * Convert window coordinates to canvas coordinates
     * @param {Number} x 
     * @param {Number} y 
     * @returns {Object} object with x and y properties
     */
    _windowToCanvas(x, y) {
        const bbox = this.canvas.getBoundingClientRect();
        return {
            x: x - bbox.left * (this.canvas.width  / bbox.width),
            y: y - bbox.top  * (this.canvas.height / bbox.height)
        };
    }

    /**
     * Convert canvas coordinates to board coordinates
     * @param {Object} coords object with x and y properties
     * @returns {Peg}
     */
    _canvasToPeg(coords) {
        const x = Math.round(coords.x / this.TWIXT_GRID_WIDTH);
        const y = Math.round(coords.y / this.TWIXT_GRID_WIDTH);
        // click location must be within 10 pixels of peg
        if ((coords.x-x*this.TWIXT_GRID_WIDTH)**2 + (coords.y-y*this.TWIXT_GRID_WIDTH)**2 <= 100) {
            return new Peg(x, y);
        }
        return null;
    }

    /**
     * Convert window coordinates to board coordinates
     * @param {Number} x 
     * @param {Number} y 
     * @returns {Peg}
     */
    windowToPeg(x, y) {
        const coords = this._windowToCanvas(x, y);
        const peg = this._canvasToPeg(coords);
        return peg;
    }

    /** Render the current board state on the canvas */
    renderBoard() {
        const ctx = this.canvas.getContext("2d");

        ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.height);

        ctx.lineWidth = 1;
    
        // draw top border
        ctx.beginPath();
        ctx.moveTo(this.TWIXT_GRID_WIDTH*2, this.TWIXT_GRID_WIDTH*1.5);
        ctx.lineTo(this.TWIXT_GRID_WIDTH*23, this.TWIXT_GRID_WIDTH*1.5);
        ctx.strokeStyle = COLORS.red;
        ctx.stroke();
        ctx.closePath();
    
        // draw bottom border
        ctx.beginPath();
        ctx.moveTo(this.TWIXT_GRID_WIDTH*2, this.TWIXT_GRID_WIDTH*23.5);
        ctx.lineTo(this.TWIXT_GRID_WIDTH*23, this.TWIXT_GRID_WIDTH*23.5);
        ctx.strokeStyle = COLORS.red;
        ctx.stroke();
        ctx.closePath();
    
        // draw left border
        ctx.beginPath();
        ctx.moveTo(this.TWIXT_GRID_WIDTH*1.5, this.TWIXT_GRID_WIDTH*2);
        ctx.lineTo(this.TWIXT_GRID_WIDTH*1.5, this.TWIXT_GRID_WIDTH*23);
        ctx.strokeStyle = COLORS.black;
        ctx.stroke();
        ctx.closePath();
    
        // draw right border
        ctx.beginPath();
        ctx.moveTo(this.TWIXT_GRID_WIDTH*23.5, this.TWIXT_GRID_WIDTH*2);
        ctx.lineTo(this.TWIXT_GRID_WIDTH*23.5, this.TWIXT_GRID_WIDTH*23);
        ctx.strokeStyle = COLORS.black;
        ctx.stroke();
        ctx.closePath();
    
        // draw pegs
        for (let i=1; i<=24; i++) {
            for (let j=1; j<=24; j++) {
                let val = this.board.getPeg([i,j]);
                let x = this.TWIXT_GRID_WIDTH*i;
                let y = this.TWIXT_GRID_WIDTH*j;
                ctx.beginPath();
                if (val === Player.X) {
                    ctx.arc(x, y, 3, 0, 2*Math.PI);
                    ctx.fillStyle = COLORS.gray;
                } else if (val === Player.R) {
                    ctx.arc(x, y, 6, 0, 2*Math.PI);
                    ctx.fillStyle = COLORS.red;
                } else if (val === Player.B) {
                    ctx.arc(x, y, 6, 0, 2*Math.PI);
                    ctx.fillStyle = COLORS.black;
                }
                ctx.fill();
                ctx.closePath();
            }
        }
    
        // draw red barriers
        for (const [peg1, peg2] of this.board.redBarrierState) {
            ctx.beginPath();
            ctx.moveTo(this.TWIXT_GRID_WIDTH*peg1.x, this.TWIXT_GRID_WIDTH*peg1.y);
            ctx.lineTo(this.TWIXT_GRID_WIDTH*peg2.x, this.TWIXT_GRID_WIDTH*peg2.y);
            ctx.strokeStyle = COLORS.red;
            ctx.stroke();
            ctx.closePath();
        }
    
        // draw black barriers
        for (const [peg1, peg2] of this.board.blackBarrierState) {
            ctx.beginPath();
            ctx.moveTo(this.TWIXT_GRID_WIDTH*peg1.x, this.TWIXT_GRID_WIDTH*peg1.y);
            ctx.lineTo(this.TWIXT_GRID_WIDTH*peg2.x, this.TWIXT_GRID_WIDTH*peg2.y);
            ctx.strokeStyle = COLORS.black;
            ctx.stroke();
            ctx.closePath();
        }

        // draw active barrier if the player is actively dragging a barrier
        if (this.game.currentEndpointPeg) {
            const movingCoords = this._windowToCanvas(this.game.movingEndpoint.x, this.game.movingEndpoint.y);
            ctx.beginPath();
            ctx.moveTo(this.TWIXT_GRID_WIDTH*this.game.currentEndpointPeg.x, this.TWIXT_GRID_WIDTH*this.game.currentEndpointPeg.y);
            ctx.lineTo(movingCoords.x, movingCoords.y);
            if (this.game.gameState === 2) {
                // player is drawing a new barrier
                if (this.game.currentPlayer === Player.B) {
                    ctx.strokeStyle = COLORS.black;
                } else if (this.game.currentPlayer === Player.R) {
                    ctx.strokeStyle = COLORS.red;
                }
            } else if (this.game.gameState === 4) {
                // player is removing an existing barrier
                ctx.strokeStyle = COLORS.gray;
            }
            ctx.stroke();
            ctx.closePath();
        }
    }
}


/** Game controller */
class Game {
    constructor() {
        this.initialize();
    }

    /** Initialize the internal state */
    initialize() {
        this.board = new Board();
        this.boardDisplay = new BoardDisplay(this.board, this)

        this.currentPlayer = Player.R;

        this.gameState = 0;
        this.currentEndpointPeg = null;
        this.movingEndpoint = null;

        this.boardDisplay.canvas.onmousedown = (e) => this.onmousedown(e);
        this.boardDisplay.canvas.onmouseup = (e) => this.onmouseup(e);
        this.boardDisplay.canvas.onmousemove = (e) => this.onmousemove(e);

        this.winner = null;

        this.setGameState(1);
    }

    /**
     * Update the state of the buttons
     * The new state should be passed in as a string giving the desired state for
     * all the buttons
     * 1. Place Peg button
     * 2. Place Barrier button
     * 3. Remove Peg button
     * 4. Remove Barrier button
     * 5. End Turn button
     * 
     * A = active, C = clickable, D = disabled, H = hidden
     * @param {String} state the desired button state
     */
    setButtonState(state) {
        const buttons = [
            document.getElementById("place-peg-button"),
            document.getElementById("place-barrier-button"),
            document.getElementById("remove-peg-button"),
            document.getElementById("remove-barrier-button"),
            document.getElementById("end-turn-button"),
            document.getElementById("new-game-button"),
        ]
        for (let i=0; i<6; i++) {
            if (state[i] === "A") {
                buttons[i].style.visibility = "visible";
                buttons[i].disabled = false;
                buttons[i].classList.add("current-selection");
            } else if (state[i] === "C") {
                buttons[i].style.visibility = "visible";
                buttons[i].disabled = false;
                buttons[i].classList.remove("current-selection");
            } else if (state[i] === "D") {
                buttons[i].style.visibility = "visible";
                buttons[i].disabled = true;
                buttons[i].classList.remove("current-selection");
            } else if (state[i] === "H") {
                buttons[i].style.visibility = "hidden";
            }
        }
    }

    /** Update the indicator of whose turn it is and what the turn state is*/
    updateInfoDiv() {
        const playerDiv = document.getElementById("player-info");
        let txt, color;
        if (this.winner === Player.R) {
            txt = "Red Player Wins!";
            color = COLORS.red;
        } else if (this.winner === Player.B) {
            txt = "Black Player Wins!";
            color = COLORS.black;
        } else if (this.currentPlayer === Player.R) {
            txt = "Red Player's Turn";
            color = COLORS.red;
        } else if (this.currentPlayer === Player.B) {
            txt = "Black Player's Turn";
            color = COLORS.black;
        }
        playerDiv.innerText = txt;
        playerDiv.style.color = color;

        const stateDiv = document.getElementById("state-info");
        switch(this.gameState) {
            case 1:
                txt = "Click on an empty space to place a peg."
                break;
            case 2:
                txt = "Click and drag between two pegs to place a barrier."
                break;
            case 3:
                txt = "Click on a peg to remove it."
                break;
            case 4:
                txt = "Click and drag between two pegs to remove the barrier between them."
                break;
            case 5:
                txt = "Game over!";
                break;
        }
        stateDiv.innerText = txt;
    }

    onmousedown(e) {
        let peg;
        switch(this.gameState) {
            case 1: // place peg
                break;
            case 2: // place barrier
                peg = this.boardDisplay.windowToPeg(e.clientX, e.clientY);
                if (peg) {
                    if (this.board.getPeg(peg.asTuple) === this.currentPlayer) {
                        this.currentEndpointPeg = peg;
                        this.movingEndpoint = {x: e.clientX, y: e.clientY};
                    }
                }
                break;
            case 3: // remove peg
                break;
            case 4: // remove barrier
                peg = this.boardDisplay.windowToPeg(e.clientX, e.clientY);
                if (peg) {
                    if (this.board.getPeg(peg.asTuple) === this.currentPlayer) {
                        if (this.board.getAdjacentPegs(peg).length > 0) {
                            this.currentEndpointPeg = peg;
                            this.movingEndpoint = {x: e.clientX, y: e.clientY};
                        }
                    }
                }
                break;
            case 5: // game over
                break;
        }
    }

    onmouseup(e) {
        const peg = this.boardDisplay.windowToPeg(e.clientX, e.clientY);
        switch(this.gameState) {
            case 1: // place peg
                if (peg) {
                    let success = this.board.placePeg(peg, this.currentPlayer);
                    if (success) {
                        this.setGameState(2);
                    }
                }
                break;
            case 2: // place barrier
                if (peg) {
                    if (this.currentEndpointPeg) {
                        let success = this.board.placeBarrier(this.currentEndpointPeg, peg, this.currentPlayer);
                        if (success) {
                            if (this.board.gameWon(this.currentPlayer)) {
                                this.winner = this.currentPlayer;
                                this.setGameState(5);
                            }
                        }
                    }
                }
                this.movingEndpoint = null;
                this.currentEndpointPeg = null;
                break;
            case 3: // remove peg
                if (peg) {
                    this.board.removePeg(peg, this.currentPlayer);
                }
                break;
            case 4: // remove barrier
                if (peg) {
                    if (this.currentEndpointPeg) {
                        this.board.removeBarrier(this.currentEndpointPeg, peg, this.currentPlayer);
                    }
                }
                this.currentEndpointPeg = null;
                this.movingEndpoint = null;
                break;
            case 5: // game over
                break;
        }
    }

    onmousemove(e) {
        switch(this.gameState) {
            case 1: // place peg
                break;
            case 2: // place barrier
                this.movingEndpoint = {x: e.clientX, y: e.clientY};
                break;
            case 3: // remove peg
                break;
            case 4: // remove barrier
                this.movingEndpoint = {x: e.clientX, y: e.clientY};
                break;
            case 5: // game over
                break;            
        }
    }

    /** 
     * Change game state and update variables and display
     * - State 1: Place peg
     * - State 2: Place barrier
     * - State 3: Remove peg
     * - State 4: Remove barrier
     * @param {Number} state state number (1-4 valid)
     */
    setGameState(state) {
        switch(state) {
            case 1:
                this.setButtonState("ADCCDH");
                break;
            case 2:
                this.currentEndpointPeg = null;
                this.movingEndpoint = null;
                this.setButtonState("DADDCH");
                break;
            case 3:
                this.setButtonState("CDACDH");
                break;
            case 4:
                this.currentEndpointPeg = null;
                this.movingEndpoint = null;
                this.setButtonState("CDCADH");
                break;
            case 5:
                this.currentEndpointPeg = null;
                this.movingEndpoint = null;
                this.setButtonState("DDDDDC")
        }
        this.gameState = state;
        this.updateInfoDiv()
    }

    /** End a player's turn and prepare for the next player's turn */
    endTurn() {
        this.currentPlayer = (this.currentPlayer===Player.R) ? Player.B : Player.R;
        this.setGameState(1);
    }
}


const game = new Game();

document.getElementById('place-peg-button').onclick = () => game.setGameState(1);
document.getElementById('place-barrier-button').onclick = () => game.setGameState(2);
document.getElementById('remove-peg-button').onclick = () => game.setGameState(3);
document.getElementById('remove-barrier-button').onclick = () => game.setGameState(4);
document.getElementById('end-turn-button').onclick = () => game.endTurn();
document.getElementById('new-game-button').onclick = () => game.initialize();

function animate() {
    game.boardDisplay.renderBoard();
    requestAnimationFrame(() => animate());
}

requestAnimationFrame(animate);
