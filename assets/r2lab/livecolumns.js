// -*- js-indent-level:4 -*-

/* for eslint */
/*global $ d3 */

"use strict";

import {load_css} from "/assets/r2lab/load-css.js";
load_css("/assets/r2lab/livecolumns.css");

import {Sidecar} from "/assets/r2lab/sidecar.js";


//
// this code is the common ground for both livetable and livehardware
//
// sidecar_url global variable is defined in template sidecar-url.js
// from sidecar_url as defined in settings.py
//

////////// configurable
export let livecolumns_options = {

    nb_nodes : 37,

    debug : false,
}

function livecolumns_debug(...args) {
    if (livecolumns_options.debug)
        console.log(...args);
}


////////////////////
// quick'n dirty helper to create <span> tags inside the <td>
// d3 should allow us to do that more nicely but I could not figure it out yet
export function span_html(text, cls) {
    let tag = cls ? ` class='${cls}'` : "";
    return `<span${tag}>${text}</span>`;
}

//////////////////////////////
// nodes are dynamic
// their table row and cells get created through d3's enter mechanism
export class LiveColumnsNode {


    constructor(id) {
        this.id = id;
    }


    // node_info is a dict coming through socket.io in JSON
    // simply copy the fields present in this dict in the local object
    // for further usage in animate_changes;
    // don't bother if no change is detected
    update_from_news(node_info) {
        let modified = false;
        for (let prop in node_info) {
            if (node_info[prop] != this[prop]) {
                this[prop] = node_info[prop];
                modified = true;
                livecolumns_debug(`node_info[${prop}] = ${node_info[prop]}`);
            }
        }

        if (! modified) {
            // livecolumns_debug(`no change on ${node_info.id} - exiting`);
            return;
        } else {
            livecolumns_debug(`id = ${node_info.id} ->`, node_info);
        }

        // this must be implemented for each view, and adjust this.cells_data
        this.compute_cells_data();
        livecolumns_debug(`after update_from_news on id=${node_info.id} -> `,
                          this.cells_data);
    }


    cell_available() {
        return (this.available == 'ko') ?
            [ span_html('', 'fa fa-ban'), 'error', 'unavailable' ] :
            [ span_html('', 'fa fa-check'), 'ok', 'node is OK for exps' ];
    }


    cell_on_off() {
        return (this.cmc_on_off == 'fail') ? [ 'N/A', 'error', 'unavailable - DO NOT USE' ]
            : this.cmc_on_off == 'on' ? [ span_html('', 'fa fa-toggle-on'), 'ok', 'ON']
            : [ span_html('', 'fa fa-toggle-off'), 'ko', 'OFF' ];
    }

    cell_data_interface() {
        // the sidecar field is named 'data_interface'
        // it can be
        // true: answer is yes
        // false: answer is no
        // undefined: answer is yes
        if (! this.data_interface) {
            return [ span_html('', 'far fa-hdd'), 'no-data', 'no data interface']
        } else {
            return [ span_html('', 'fas fa-grip-lines'), '', 'data interface available']
        }
    }


    cell_sdr(mention_duplexer) {
        let alt_text = "";
        alt_text += (this.gnuradio_release)
            ? `gnuradio_release = ${this.gnuradio_release}`
            : `no gnuradio installed`;
        let text = this.usrp_type || '-';
        if (mention_duplexer && this.usrp_duplexer)
            text += `/${this.usrp_duplexer}`;
        text += ' ';
        text += (this.usrp_on_off == 'on')
            ? span_html('', 'fa fa-toggle-on')
            : span_html('', 'fa fa-toggle-off') ;
        let cell = `<span title="${alt_text}">${text}</span>`;
        let klass = (this.usrp_on_off == 'on') ? 'ok'
            : (this.usrp_on_off == 'off') ? 'ko' : 'error';
        return [cell, klass];
    }


    // used to find out which entries are worth being kept
    // when clicking the header area
    is_worth() {
        return true;
    }


    set_display(display) {
        let selector = `tbody.livecolumns_body #row${this.id}`;
        display ? $(selector).show() : $(selector).hide();
    }


}

//////////////////////////////
// the base class for both LiveHardware and LiveTable
export class LiveColumns {


    constructor() {
        this.nodes = [];
        /* mode is either 'all' or 'worth' */
        this.view_mode = 'all';
    }


    init() {
        let headers = this.init_table();
        // needs to be written
        this.init_headers(headers);
        // needs to be written
        this.init_nodes();
        this.init_sidecar();
        // re-trigger tooltip behaviour
        // xxx should probably be limited to our own scope
        $('[data-toggle="tooltip"]').tooltip()
    }


    init_table() {
        let containers = d3.selectAll(`#${this.domid}`);
        containers.append('thead').attr('class', 'livecolumns_header');
        containers.append('tbody').attr('class', 'livecolumns_body');
        containers.append('tfoot').attr('class', 'livecolumns_header');

        let self = this;
        let headers = d3.selectAll('.livecolumns_header').append('tr')
            .attr('class', 'all')
            .on('click', function(){self.toggle_view_mode();})
        ;
        return headers;
    }


    locate_node_by_id(id) {
        return this.nodes[id-1];
    }


    toggle_view_mode () {
        livecolumns_debug(`display_nodes ${this.view_mode}`);
        this.view_mode = (this.view_mode == 'all') ? 'worth' : 'all';
        this.display_nodes(this.view_mode);
        $(".livecolumns_header tr").toggleClass('all');
    }


    display_nodes(mode) {
        for (let node of this.nodes) {
            let display = (mode=='all') ? true : (node.is_worth());
            node.set_display(display);
        }
    }


    // this code uses d3 nested selections
    // I had to tweak it when adopting d3-v4 as per
    // http://stackoverflow.com/questions/39861603/d3-js-v4-nested-selections
    // not that I have understood the bottom of it, but it works again..
    animate_changes(/*nodes_info*/) {
        livecolumns_debug("animate_changes");
        let tbody = d3.select("tbody.livecolumns_body");
        // row update selection
        let rows = tbody.selectAll('tr')
            .data(this.nodes, LiveColumns.get_node_id);
        ////////// create rows as needed
        let rowsenter = rows.enter()
            .append('tr')
            .attr('id', function(node){ return 'row' + node.id;})
        ;
        // the magic here is to pass rowsenter to the merge method
        // instead of rows
        let cells =
            rows.merge(rowsenter)
            .selectAll('td')
            .data(LiveColumns.get_node_data);

        cells
          .enter()
            .append('td')
          .merge(cells)
            .html(LiveColumns.get_html)
            .attr('class', LiveColumns.get_class)
            .attr('data-toggle', 'tooltip')
            .attr('title', '')
            .attr('data-original-title', LiveColumns.get_tooltip)
            .each(function(d, i) {
                // attach a click event on the first column only
                if (i == 0) {
                    $(this).click(function() {
                        $(this).parent().attr('style', 'display:none');
                    })
                }
                $(this).find('[data-toggle="tooltip"]').tooltip();
            });
    }

    // related helpers
    static get_node_id(node)  {return node.id;}
    static get_node_data(node){return node.cells_data;}
    // the data associated to a given cell can be either 
    // (*) a couple (html + class)
    // (*) a triple (html + class + tooltip)
    // rewriting info should happen in update_from_news
    static get_html(tuple)    {return (tuple === undefined) ? 'n/a' : tuple[0]}
    static get_class(tuple)   {return (tuple === undefined) ? '' : tuple[1]}
    static get_tooltip(triple) {return (triple === undefined) ? '' : (triple[2] === undefined) ? '' : triple[2]}


    ////////// socket.io business
    nodes_callback(infos) {
        let livecolumns = this;
        infos.forEach(function(node_info) {
            let id = node_info['id'];
            let node = livecolumns.locate_node_by_id(id);
            if (node != undefined)
                node.update_from_news(node_info);
            else
                console.log(`livecolumns: could not locate node id ${id} - ignored`);
        });
        this.animate_changes(infos)
        // animate_changes messes with tooltips
        $('[data-toggle="tooltip"]').tooltip()
    }

    init_sidecar() {
        let callbacks_map = {
            nodes:  (infos) => this.nodes_callback(infos),
        }
        let categories = ['nodes'];
        // this actually is a singleton
        this.sidecar = Sidecar();
        this.sidecar.register_callbacks_map(callbacks_map);
        this.sidecar.register_categories(categories);
        this.sidecar.open();
    }

}
