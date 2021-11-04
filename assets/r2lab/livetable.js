// -*- js-indent-level:4 -*-

/* for eslint */
/*global $*/

"use strict";

import {load_css} from "/assets/r2lab/load-css.js";
load_css("/assets/r2lab/livetable.css");

import {LiveColumnsNode, LiveColumns, livecolumns_options, span_html} from '/assets/r2lab/livecolumns.js' ;

////////// configurable
export let livetable_options = {

    fedora_badge : '<img src="/assets/img/fedora-logo.png">',
    centos_badge : '<img src="/assets/img/centos-logo.png">',
    ubuntu_badge : '<img src="/assets/img/ubuntu-logo.png">',
    other_badge : '<img src="/assets/img/other-logo.png">',

}

//////////////////////////////
// nodes are dynamic
// their table row and cells get created through d3 enter mechanism
export class LiveTableNode extends LiveColumnsNode {

    constructor(id) {
        super(id);

        this.cells_data = [
            [ span_html(id, 'badge pointer'), '' ],     // id
            undefined,                          // avail
            undefined,                          // on/off
            undefined,                          // usrp-on-off
            undefined,                          // ping
            undefined,                          // ssh
            undefined,                          // os_release
//            undefined,                          // uname
            undefined,                          // image_radical
        ];
    }

    // nodes worth being followed when clicking on the table banner
    is_worth() {
        return (   this.cmc_on_off == 'on'
                || this.usrp_on_off == 'on'
                || this.control_ping == 'on'
                || this.control_ssh == 'on' )
                && this.available != 'ko';
    }


    // after the internal properties are updated from the incoming JSON message
    // we need to rewrite actual representation in cells_data
    // that will contain a list of ( html_text, class )
    // used by the d3 mechanism to update the <td> elements in the row
    compute_cells_data () {
        let col = 1
        // available
        this.cells_data[col++] = this.cell_available();
        // on/off
        this.cells_data[col++] = this.cell_on_off();
        // usrp
        this.cells_data[col++] = this.cell_sdr(true);
        // ping
        this.cells_data[col++] =
            (this.control_ping == 'on')
            ? [ span_html('', 'fa fa-link'), 'ok' ]
            : [ span_html('', 'fa fa-unlink'), 'ko' ];
        // ssh
        this.cells_data[col++] =
            this.control_ssh == 'on' ? [ span_html('', 'fa fa-circle'), 'ok' ]
            : [ span_html('', 'fa fa-circle-o'), 'ko' ];
        //
        this.cells_data[col++] = this.cell_release(
            this.os_release, this.uname, this.control_ssh)
//        this.cells_data[col++] = this.cell_uname(this.uname);
        this.cells_data[col++] = this.cell_image(this.image_radical, this.control_ssh);
    }

    cell_release(os_release, uname, control_ssh) {
        // use a single css class for now
        let klass = control_ssh == 'on' ? 'os ok' : 'os ko'
        function tooltip(main) {
            return `<span data-toggle="tooltip" title="last uname=${uname}">${main}</span>`
        }
        if (os_release == undefined)
            return [ "n/a", klass ];
        if (os_release.startsWith('fedora'))
            return [ tooltip(`${livetable_options.fedora_badge} ${os_release}`), klass ];
        else if (os_release.startsWith('centos'))
            return [ tooltip(`${livetable_options.centos_badge} ${os_release}`), klass ];
        else if (os_release.startsWith('ubuntu'))
            return [ tooltip(`${livetable_options.ubuntu_badge} ${os_release}`), klass ];
        else if (os_release == 'other')
            return [ tooltip(`${livetable_options.other_badge} (ssh OK)`),  klass ];
        else
            return [ 'n/a', klass ];
      }


    cell_image(image_radical, control_ssh) {
        let klass = control_ssh == 'on' ? 'image ok' : 'image ko'
        if (image_radical == undefined)
            return [ "n/a", klass ];
        return [ image_radical, klass ];
    }
}

//////////////////////////////
export class LiveTable extends LiveColumns{

    constructor(domid) {
        super();
        this.domid = domid;
    }


    init_headers(header) {
        header.append('th').html('#')
            .attr('data-toggle', 'tooltip').attr('title', 'node #')
        header.append('th').html('<span class="fa fa-check-square-o"></span>')
            .attr('data-toggle', 'tooltip').attr('title', 'availability')
        header.append('th').html('<span class="fa fa-toggle-off"></span>')
            .attr('data-toggle', 'tooltip').attr('title', 'on/off')
        header.append('th').html('sdr')
        header.append('th').html('<span class="fa fa-link"></span>')
            .attr('data-toggle', 'tooltip').attr('title', 'ping')
        header.append('th').html('<span class="fa fa-circle-o"></span>')
            .attr('data-toggle', 'tooltip').attr('title', 'ssh')
        header.append('th').html('last O.S.')
//        header.append('th').html('last uname')
        header.append('th').html('last image')
    }

    init_nodes() {
        for (let i=0; i < livecolumns_options.nb_nodes; i++) {
            this.nodes[i] = new LiveTableNode(i+1);
        }
    }
}

////////// autoload
$(function() {
    // name it for debugging from the console
    let livetable = new LiveTable("livetable_container");
    livetable.init();
})
